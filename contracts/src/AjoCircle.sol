// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title AjoCircle
 * @notice Decentralised rotating savings circle (ROSCA) denominated in any ERC-20 token.
 *         Members contribute equal amounts each round; the full pot rotates to one member
 *         per round in join order until every member has received exactly one payout.
 */
contract AjoCircle is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── Types ───────────────────────────────────────────────────────────────

    enum Status {
        Open, // accepting members, not yet started
        Active, // contributions & payouts in progress
        Completed // all rounds done
    }

    struct Circle {
        address creator;
        IERC20 token;
        uint256 contributionAmount;
        uint256 maxMembers;
        uint256 roundDuration; // seconds; informational — not enforced on-chain
        address[] members;
        uint256 currentRound;
        uint256 roundStartTime;
        uint256 contributionCount; // resets each round
        Status status;
        mapping(address => bool) isMember;
        mapping(uint256 => mapping(address => bool)) contributed; // round → member → paid
        mapping(uint256 => bool) roundPaidOut;
    }

    struct CircleView {
        uint256 id;
        address creator;
        address token;
        uint256 contributionAmount;
        uint256 maxMembers;
        uint256 roundDuration;
        address[] members;
        uint256 currentRound;
        uint256 roundStartTime;
        uint256 contributionCount;
        Status status;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    uint256 public circleCount;
    mapping(uint256 => Circle) private _circles;

    // ─── Events ──────────────────────────────────────────────────────────────

    event CircleCreated(
        uint256 indexed id,
        address indexed creator,
        address token,
        uint256 contributionAmount,
        uint256 maxMembers,
        uint256 roundDuration
    );
    event MemberJoined(uint256 indexed id, address indexed member);
    event CircleStarted(uint256 indexed id, uint256 startTime);
    event ContributionMade(uint256 indexed id, uint256 indexed round, address indexed contributor);
    event PayoutDistributed(
        uint256 indexed id, uint256 indexed round, address indexed recipient, uint256 amount
    );
    event CircleCompleted(uint256 indexed id);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error Unauthorized();
    error InvalidParam(string reason);
    error CircleNotOpen();
    error CircleNotActive();
    error AlreadyMember();
    error CircleFull();
    error NotMember();
    error AlreadyContributed();
    error RoundNotComplete();
    error RoundAlreadyPaidOut();

    // ─── Modifiers ───────────────────────────────────────────────────────────

    modifier onlyCreator(uint256 id) {
        if (_circles[id].creator != msg.sender) revert Unauthorized();
        _;
    }

    modifier onlyMember(uint256 id) {
        if (!_circles[id].isMember[msg.sender]) revert NotMember();
        _;
    }

    // ─── External functions ──────────────────────────────────────────────────

    /**
     * @notice Create a new savings circle. The caller automatically becomes the first member.
     * @param token            ERC-20 token used for contributions (e.g. G$ on Celo).
     * @param contributionAmount Amount each member contributes per round (in token wei).
     * @param maxMembers       Total seats in the circle (2–20).
     * @param roundDuration    Suggested round length in seconds (≥ 1 day); informational only.
     * @return id              ID of the newly created circle.
     */
    function createCircle(
        address token,
        uint256 contributionAmount,
        uint256 maxMembers,
        uint256 roundDuration
    ) external returns (uint256 id) {
        if (token == address(0)) revert InvalidParam("zero token");
        if (contributionAmount == 0) revert InvalidParam("zero contribution");
        if (maxMembers < 2 || maxMembers > 20) revert InvalidParam("maxMembers 2-20");
        if (roundDuration < 1 days) revert InvalidParam("roundDuration >= 1 day");

        id = circleCount++;
        Circle storage c = _circles[id];
        c.creator = msg.sender;
        c.token = IERC20(token);
        c.contributionAmount = contributionAmount;
        c.maxMembers = maxMembers;
        c.roundDuration = roundDuration;
        c.status = Status.Open;

        c.members.push(msg.sender);
        c.isMember[msg.sender] = true;

        emit CircleCreated(id, msg.sender, token, contributionAmount, maxMembers, roundDuration);
        emit MemberJoined(id, msg.sender);
    }

    /**
     * @notice Join an open circle. Reverts if the circle is full or already started.
     */
    function joinCircle(uint256 id) external {
        Circle storage c = _circles[id];
        if (c.status != Status.Open) revert CircleNotOpen();
        if (c.isMember[msg.sender]) revert AlreadyMember();
        if (c.members.length >= c.maxMembers) revert CircleFull();

        c.members.push(msg.sender);
        c.isMember[msg.sender] = true;

        emit MemberJoined(id, msg.sender);
    }

    /**
     * @notice Creator starts the circle. Requires ≥ 2 members.
     */
    function startCircle(uint256 id) external onlyCreator(id) {
        Circle storage c = _circles[id];
        if (c.status != Status.Open) revert CircleNotOpen();
        if (c.members.length < 2) revert InvalidParam("need >= 2 members");

        c.status = Status.Active;
        c.roundStartTime = block.timestamp;

        emit CircleStarted(id, block.timestamp);
    }

    /**
     * @notice Contribute to the current round. Caller must have approved this contract.
     *         Automatically distributes the payout when all members have contributed.
     */
    function contribute(uint256 id) external nonReentrant onlyMember(id) {
        Circle storage c = _circles[id];
        if (c.status != Status.Active) revert CircleNotActive();

        uint256 round = c.currentRound;
        if (c.contributed[round][msg.sender]) revert AlreadyContributed();

        c.contributed[round][msg.sender] = true;
        c.contributionCount++;

        c.token.safeTransferFrom(msg.sender, address(this), c.contributionAmount);
        emit ContributionMade(id, round, msg.sender);

        if (c.contributionCount == c.members.length) {
            _distributeRound(id);
        }
    }

    /**
     * @notice Manually trigger payout distribution once all contributions are in.
     *         Normally called automatically by `contribute`; exposed as a fallback.
     */
    function distributeRound(uint256 id) external nonReentrant {
        Circle storage c = _circles[id];
        if (c.status != Status.Active) revert CircleNotActive();
        if (c.contributionCount < c.members.length) revert RoundNotComplete();
        _distributeRound(id);
    }

    // ─── Views ───────────────────────────────────────────────────────────────

    function getCircle(uint256 id) external view returns (CircleView memory) {
        Circle storage c = _circles[id];
        return CircleView({
            id: id,
            creator: c.creator,
            token: address(c.token),
            contributionAmount: c.contributionAmount,
            maxMembers: c.maxMembers,
            roundDuration: c.roundDuration,
            members: c.members,
            currentRound: c.currentRound,
            roundStartTime: c.roundStartTime,
            contributionCount: c.contributionCount,
            status: c.status
        });
    }

    function hasContributed(uint256 id, uint256 round, address member)
        external
        view
        returns (bool)
    {
        return _circles[id].contributed[round][member];
    }

    function isMember(uint256 id, address account) external view returns (bool) {
        return _circles[id].isMember[account];
    }

    function currentRecipient(uint256 id) external view returns (address) {
        Circle storage c = _circles[id];
        if (c.status != Status.Active) return address(0);
        return c.members[c.currentRound % c.members.length];
    }

    // ─── Internal ────────────────────────────────────────────────────────────

    function _distributeRound(uint256 id) internal {
        Circle storage c = _circles[id];
        uint256 round = c.currentRound;

        if (c.roundPaidOut[round]) revert RoundAlreadyPaidOut();

        address recipient = c.members[round % c.members.length];
        uint256 payout = c.contributionAmount * c.members.length;

        // Effects before interaction (CEI)
        c.roundPaidOut[round] = true;
        c.contributionCount = 0;
        c.currentRound = round + 1;

        if (c.currentRound >= c.members.length) {
            c.status = Status.Completed;
        }

        c.token.safeTransfer(recipient, payout);
        emit PayoutDistributed(id, round, recipient, payout);

        if (c.status == Status.Completed) {
            emit CircleCompleted(id);
        }
    }
}
