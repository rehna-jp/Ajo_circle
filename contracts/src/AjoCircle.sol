// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IIdentity} from "./interfaces/IIdentity.sol";

/// @dev Matches the AjoYieldVault interface — deposit pulls tokens, withdrawAll returns the full pot.
interface IYieldVault {
    function deposit(uint256 amount) external;
    function withdrawAll() external returns (uint256 total);
}

/**
 * @title AjoCircle
 * @notice A single rotating savings circle (ROSCA) instance on Celo, denominated in G$ tokens.
 *         Each deployed AjoCircle represents one savings group. Members join by posting
 *         collateral, then contribute G$ each cycle. At the end of a cycle the full pot
 *         (contributions + any vault yield) is sent to one member in join order. This repeats
 *         until every original member has received the pot exactly once.
 * @dev    Deployed and tracked by {AjoFactory}. The `members` array is append-only; slashed
 *         members are deactivated via `isMember` rather than removed, so join-order indices
 *         remain stable across the lifetime of the circle.
 */
contract AjoCircle is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @notice Join collateral expressed in basis points. 1000 = 10% of `contributionAmount`.
    uint256 public constant COLLATERAL_BPS = 1000;

    /// @notice Grace period after cycle ends before `triggerPayout` becomes callable.
    uint256 public constant GRACE_PERIOD = 1 hours;

    // ─── Circle metadata ──────────────────────────────────────────────────────

    string public name;
    uint256 public contributionAmount;
    uint256 public maxMembers;
    uint256 public cycleDuration;

    // ─── Addresses ────────────────────────────────────────────────────────────

    address public gDollarToken;
    address public yieldVault;
    address public identityContract;
    address public creator;

    // ─── Cycle tracking ───────────────────────────────────────────────────────

    uint256 public currentCycle;
    uint256 public cycleStartTime;
    uint256 public currentPayoutIndex;

    // ─── Members ──────────────────────────────────────────────────────────────

    /// @notice All addresses that have ever joined, in join order. Never shrinks.
    address[] public members;

    /// @notice Count of currently active (non-slashed) members.
    uint256 public activeMemberCount;

    /// @notice True when `account` is an active, non-slashed member.
    mapping(address => bool) public isMember;

    /// @notice Collateral posted by each member; zeroed upon slash.
    mapping(address => uint256) public collateral;

    // ─── Contributions ────────────────────────────────────────────────────────

    mapping(address => mapping(uint256 => bool)) public hasContributed;

    // ─── Payouts ──────────────────────────────────────────────────────────────

    mapping(address => bool) public hasReceivedPayout;

    // ─── Private accounting ───────────────────────────────────────────────────

    /// @dev Running total of G$ deposited this cycle. Used as the pot when no vault is set.
    uint256 private _cycleDeposits;

    // ─── Events ──────────────────────────────────────────────────────────────

    event MemberJoined(address indexed member, uint256 collateralAmount);
    event ContributionMade(address indexed member, uint256 indexed cycle, uint256 amount);
    event PayoutSent(address indexed recipient, uint256 indexed cycle, uint256 amount);
    event CollateralSlashed(address indexed member, uint256 amount);
    event MemberRemoved(address indexed member);
    event CircleStarted(uint256 startTime);
    event CycleAdvanced(uint256 indexed newCycle, uint256 cycleStartTime);
    event EmergencyWithdrawal(address indexed member, uint256 amount);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error AlreadyMember();
    error CircleFull();
    error IdentityNotVerified();
    error NotMember();
    error CircleNotStarted();
    error AlreadyContributed();
    error CycleNotEnded();
    error NoPayoutsRemaining();
    error NoEligibleRecipient();
    error EmptyPot();
    error CircleNotComplete();

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @notice Deploy a new AjoCircle instance. Intended to be called only by {AjoFactory}.
     * @param _name               Human-readable circle name (non-empty).
     * @param _contributionAmount G$ amount each member contributes per cycle (> 0).
     * @param _maxMembers         Total member seats, inclusive (2–20).
     * @param _cycleDuration      Minimum cycle length in seconds (≥ 1 day).
     * @param _gDollarToken       G$ ERC-20 token address on Celo (non-zero).
     * @param _yieldVault         AjoYieldVault address for idle fund yield; address(0) disables.
     * @param _identityContract   GoodDollar identity registry; address(0) disables KYC check.
     * @param _creator            Address of the factory caller that initiated deployment.
     */
    constructor(
        string memory _name,
        uint256 _contributionAmount,
        uint256 _maxMembers,
        uint256 _cycleDuration,
        address _gDollarToken,
        address _yieldVault,
        address _identityContract,
        address _creator
    ) {
        require(bytes(_name).length > 0, "empty name");
        require(_contributionAmount > 0, "zero contribution");
        require(_maxMembers >= 2 && _maxMembers <= 20, "maxMembers 2-20");
        require(_cycleDuration >= 1 days, "cycleDuration >= 1 day");
        require(_gDollarToken != address(0), "zero token");
        require(_creator != address(0), "zero creator");

        name = _name;
        contributionAmount = _contributionAmount;
        maxMembers = _maxMembers;
        cycleDuration = _cycleDuration;
        gDollarToken = _gDollarToken;
        yieldVault = _yieldVault;
        identityContract = _identityContract;
        creator = _creator;
    }

    // ─── External functions ───────────────────────────────────────────────────

    /**
     * @notice Join the savings circle by posting G$ collateral.
     * @dev    Collateral = `contributionAmount` × COLLATERAL_BPS / 10_000 (10% by default).
     *         When `identityContract` is set, the caller must be GoodDollar-whitelisted.
     *         Filling the final seat atomically starts the first cycle by setting
     *         `cycleStartTime` to the current block timestamp.
     *         Caller must pre-approve this contract for the collateral amount before calling.
     */
    function joinCircle() external nonReentrant {
        if (isMember[msg.sender]) revert AlreadyMember();
        if (activeMemberCount >= maxMembers) revert CircleFull();
        if (
            identityContract != address(0)
                && !IIdentity(identityContract).isWhitelisted(msg.sender)
        ) revert IdentityNotVerified();

        uint256 collateralAmount = (contributionAmount * COLLATERAL_BPS) / 10_000;
        IERC20(gDollarToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        members.push(msg.sender);
        activeMemberCount++;
        isMember[msg.sender] = true;
        collateral[msg.sender] = collateralAmount;

        // Starting the circle is an effect, so set it before emitting.
        if (activeMemberCount == maxMembers) {
            cycleStartTime = block.timestamp;
            emit CircleStarted(block.timestamp);
        }

        emit MemberJoined(msg.sender, collateralAmount);
    }

    /**
     * @notice Contribute `contributionAmount` of G$ for the current cycle.
     * @dev    When a `yieldVault` is configured, tokens are forwarded to the vault
     *         immediately after transfer so they earn yield until payout.
     *         Caller must pre-approve this contract for `contributionAmount` before calling.
     */
    function contribute() external nonReentrant {
        if (!isMember[msg.sender]) revert NotMember();
        if (cycleStartTime == 0) revert CircleNotStarted();
        if (hasContributed[msg.sender][currentCycle]) revert AlreadyContributed();

        IERC20(gDollarToken).safeTransferFrom(msg.sender, address(this), contributionAmount);

        if (yieldVault != address(0)) {
            IERC20(gDollarToken).forceApprove(yieldVault, contributionAmount);
            IYieldVault(yieldVault).deposit(contributionAmount);
        }

        hasContributed[msg.sender][currentCycle] = true;
        _cycleDeposits += contributionAmount;

        emit ContributionMade(msg.sender, currentCycle, contributionAmount);
    }

    /**
     * @notice End the current cycle: slash non-contributors, collect the pot, and pay
     *         the designated cycle recipient.
     * @dev    Can be called by anyone once `cycleStartTime + cycleDuration + GRACE_PERIOD`
     *         has elapsed. Non-contributors are slashed FIRST so a defaulting member
     *         cannot be selected as recipient. Uses a dynamic check for remaining payouts
     *         instead of a hard `maxMembers` cap to avoid deadlock when members are slashed.
     */
    function triggerPayout() external nonReentrant {
        if (cycleStartTime == 0) revert CircleNotStarted();
        if (block.timestamp < cycleStartTime + cycleDuration + GRACE_PERIOD) revert CycleNotEnded();

        // Dynamic check: are there any active members who haven't been paid yet?
        if (!_hasPendingPayouts()) revert NoPayoutsRemaining();

        uint256 cycleJustFinished = currentCycle;

        // ── Slash FIRST ───────────────────────────────────────────────────────
        // Deactivate non-contributors before selecting recipient, so a defaulter
        // who is next in line cannot receive the pot.
        _slashNonContributors(cycleJustFinished);

        // Walk the join-order list to find the next active, unpaid member.
        uint256 idx = currentPayoutIndex;
        while (
            idx < members.length
                && (!isMember[members[idx]] || hasReceivedPayout[members[idx]])
        ) {
            idx++;
        }
        if (idx >= members.length) revert NoEligibleRecipient();

        address recipient = members[idx];

        // ── Effects ───────────────────────────────────────────────────────────
        hasReceivedPayout[recipient] = true;
        currentPayoutIndex = idx + 1;
        currentCycle++;
        uint256 deposited = _cycleDeposits;
        _cycleDeposits = 0;
        cycleStartTime = block.timestamp; // begin next cycle window

        // ── Interactions ──────────────────────────────────────────────────────

        // Collect the pot: withdraw from vault (principal + yield), or use direct tally.
        uint256 pot;
        if (yieldVault != address(0)) {
            pot = IYieldVault(yieldVault).withdrawAll();
        } else {
            pot = deposited;
        }
        if (pot == 0) revert EmptyPot();

        // Pay the recipient.
        IERC20(gDollarToken).safeTransfer(recipient, pot);
        emit PayoutSent(recipient, cycleJustFinished, pot);
        emit CycleAdvanced(currentCycle, cycleStartTime);
    }

    /**
     * @notice Return remaining collateral to all members after the circle has completed.
     * @dev    Callable by any member once no active, unpaid members remain.
     *         Returns collateral individually; any residual contract balance stays.
     */
    function emergencyWithdraw() external nonReentrant {
        if (_hasPendingPayouts()) revert CircleNotComplete();

        for (uint256 i; i < members.length; i++) {
            address m = members[i];
            if (collateral[m] > 0) {
                uint256 amt = collateral[m];
                collateral[m] = 0;
                IERC20(gDollarToken).safeTransfer(m, amt);
                emit EmergencyWithdrawal(m, amt);
            }
        }
    }

    // ─── View functions ───────────────────────────────────────────────────────

    /**
     * @notice Number of currently active (non-slashed) members.
     * @return count Active member count.
     */
    function getMemberCount() external view returns (uint256 count) {
        return activeMemberCount;
    }

    /**
     * @notice Active member addresses in join order (slashed members excluded).
     * @return active Packed array of currently active member addresses.
     */
    function getMembers() external view returns (address[] memory active) {
        active = new address[](activeMemberCount);
        uint256 j;
        for (uint256 i; i < members.length; i++) {
            if (isMember[members[i]]) active[j++] = members[i];
        }
    }

    /**
     * @notice The next scheduled payout recipient and the timestamp when the cycle ends.
     * @return recipient Address of the next member in line for the pot; address(0) if none.
     * @return cycleEnd  Unix timestamp after which `triggerPayout` can be called.
     */
    function getNextPayout() external view returns (address recipient, uint256 cycleEnd) {
        uint256 idx = currentPayoutIndex;
        while (
            idx < members.length
                && (!isMember[members[idx]] || hasReceivedPayout[members[idx]])
        ) {
            idx++;
        }
        recipient = idx < members.length ? members[idx] : address(0);
        cycleEnd = cycleStartTime + cycleDuration + GRACE_PERIOD;
    }

    /**
     * @notice Returns true if `account` is currently an active (non-slashed) member.
     * @param account Address to query.
     * @return        True when `account` holds an active seat in this circle.
     */
    function isMemberActive(address account) external view returns (bool) {
        return isMember[account];
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    /**
     * @notice Returns true if at least one active member has not yet received a payout.
     */
    function _hasPendingPayouts() internal view returns (bool) {
        for (uint256 i; i < members.length; i++) {
            if (isMember[members[i]] && !hasReceivedPayout[members[i]]) {
                return true;
            }
        }
        return false;
    }

    /**
     * @notice Slash every active member who did not contribute in `cycle` and distribute
     *         the seized collateral equally among compliant members.
     * @dev    Two-pass approach: first pass is effects-only (update state, emit events);
     *         second pass is the actual G$ transfer to compliant members.
     *         Remainder from integer division goes to the last active member.
     * @param cycle The cycle index whose contributions are checked.
     */
    function _slashNonContributors(uint256 cycle) internal {
        uint256 totalSlashed;

        // Pass 1 — effects: identify non-contributors, zero their collateral, deactivate.
        for (uint256 i; i < members.length; i++) {
            address member = members[i];
            if (!isMember[member]) continue;

            if (!hasContributed[member][cycle] && collateral[member] > 0) {
                uint256 amount = collateral[member];
                collateral[member] = 0;
                isMember[member] = false;
                activeMemberCount--;
                totalSlashed += amount;
                emit CollateralSlashed(member, amount);
                emit MemberRemoved(member);
            }
        }

        // Pass 2 — interactions: distribute seized collateral pro-rata to compliant members.
        // Remainder (dust) from integer division goes to the last active member.
        if (totalSlashed > 0 && activeMemberCount > 0) {
            uint256 share = totalSlashed / activeMemberCount;
            uint256 remainder = totalSlashed % activeMemberCount;
            if (share > 0 || remainder > 0) {
                uint256 count;
                for (uint256 i; i < members.length; i++) {
                    if (isMember[members[i]]) {
                        count++;
                        uint256 amt = share;
                        if (count == activeMemberCount) {
                            amt += remainder; // last active member gets dust
                        }
                        if (amt > 0) {
                            IERC20(gDollarToken).safeTransfer(members[i], amt);
                        }
                    }
                }
            }
        }
    }
}
