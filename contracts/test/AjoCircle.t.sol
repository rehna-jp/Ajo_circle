// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {AjoFactory} from "../src/AjoFactory.sol";
import {AjoCircle} from "../src/AjoCircle.sol";
import {AjoYieldVault} from "../src/AjoYieldVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Mock contracts ───────────────────────────────────────────────────────────

contract MockGDollar is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/// @dev Configurable per-address whitelist — simulates the GoodDollar identity registry.
contract MockIdentity {
    mapping(address => bool) private _whitelist;

    function setWhitelisted(address account, bool status) external {
        _whitelist[account] = status;
    }

    function isWhitelisted(address account) external view returns (bool) {
        return _whitelist[account];
    }
}

// ─── Test suite ───────────────────────────────────────────────────────────────

contract AjoCircleTest is Test {
    // ── Constants ────────────────────────────────────────────────────────────

    uint256 constant CONTRIBUTION = 100e18;
    uint256 constant CYCLE        = 7 days;
    uint256 constant MAX_MEMBERS  = 3;
    uint256 constant YIELD_AMOUNT = 30e18;

    // ── Re-declared events for vm.expectEmit ─────────────────────────────────

    // AjoCircle
    event MemberJoined(address indexed member, uint256 collateralAmount);
    event ContributionMade(address indexed member, uint256 indexed cycle, uint256 amount);
    event PayoutSent(address indexed recipient, uint256 indexed cycle, uint256 amount);
    event CollateralSlashed(address indexed member, uint256 amount);
    event MemberRemoved(address indexed member);
    // AjoYieldVault
    event Deposited(address indexed circle, uint256 amount);
    event Withdrawn(address indexed circle, uint256 amount, uint256 yield);

    // ── Pure helpers ─────────────────────────────────────────────────────────

    /// @dev Matches AjoCircle.COLLATERAL_BPS = 1000 (10 %).
    function _collateral(uint256 amount) internal pure returns (uint256) {
        return (amount * 1000) / 10_000;
    }

    // ── Deployment helpers ───────────────────────────────────────────────────

    function _deployCore()
        internal
        returns (MockGDollar token, MockIdentity identity, AjoFactory factory)
    {
        token    = new MockGDollar();
        identity = new MockIdentity();
        factory  = new AjoFactory();
    }

    /// Deploy a circle with no yield vault.
    function _newCircle(
        AjoFactory factory,
        address token,
        address identity,
        uint256 amount
    ) internal returns (AjoCircle) {
        address addr = factory.createCircle(
            "Test Circle", amount, MAX_MEMBERS, CYCLE, token, address(0), identity
        );
        return AjoCircle(addr);
    }

    /// Deploy a circle wired to a vault; approve the new circle in the vault.
    /// The test contract must own the vault (deploy it without pranking).
    function _newCircleWithVault(
        AjoFactory factory,
        address token,
        address identity,
        AjoYieldVault vault,
        uint256 amount
    ) internal returns (AjoCircle) {
        address addr = factory.createCircle(
            "Vault Circle", amount, MAX_MEMBERS, CYCLE, token, address(vault), identity
        );
        vault.approveCircle(addr); // test contract is vault owner
        return AjoCircle(addr);
    }

    // ── Member helpers ───────────────────────────────────────────────────────

    /// Whitelist, fund, approve, and join — all in one call.
    function _prepareAndJoin(
        address member,
        MockGDollar token,
        MockIdentity identity,
        AjoCircle circle,
        uint256 mintAmount
    ) internal {
        identity.setWhitelisted(member, true);
        token.mint(member, mintAmount);
        vm.startPrank(member);
        token.approve(address(circle), type(uint256).max);
        circle.joinCircle();
        vm.stopPrank();
    }

    function _contribute(address member, AjoCircle circle) internal {
        vm.prank(member);
        circle.contribute();
    }

    // ── Composite fixture helpers ─────────────────────────────────────────────

    /// Full setup with no vault: deploy everything, create circle, all 3 members join.
    /// Filling the circle sets cycleStartTime. Members have generous token balances.
    function _fullSetup()
        internal
        returns (
            MockGDollar token,
            AjoCircle circle,
            address alice,
            address bob,
            address carol
        )
    {
        (MockGDollar t, MockIdentity id, AjoFactory f) = _deployCore();
        token  = t;
        circle = _newCircle(f, address(t), address(id), CONTRIBUTION);

        alice = makeAddr("alice");
        bob   = makeAddr("bob");
        carol = makeAddr("carol");

        uint256 each = CONTRIBUTION * 6; // covers collateral + 3 full contribution cycles
        _prepareAndJoin(alice, t, id, circle, each);
        _prepareAndJoin(bob,   t, id, circle, each);
        _prepareAndJoin(carol, t, id, circle, each); // fills circle → cycleStartTime = now
    }

    /// Extend _fullSetup: alice and bob contribute, carol defaults, time is warped.
    /// Tests call triggerPayout themselves so they can set balance snapshots first.
    function _setupOneDefaulter()
        internal
        returns (
            MockGDollar token,
            AjoCircle circle,
            address alice,
            address bob,
            address carol
        )
    {
        (token, circle, alice, bob, carol) = _fullSetup();
        _contribute(alice, circle);
        _contribute(bob,   circle);
        // carol intentionally skips her contribution
        vm.warp(block.timestamp + CYCLE + 1);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Happy-path tests
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice End-to-end: 3 members join, all contribute, payout triggers correctly.
     *         Verifies the PayoutSent event and alice's balance increase.
     */
    function test_FullCircleFlow() public {
        (MockGDollar token, AjoCircle circle, address alice, address bob, address carol) =
            _fullSetup();

        _contribute(alice, circle);
        _contribute(bob,   circle);
        _contribute(carol, circle);

        vm.warp(block.timestamp + CYCLE + 1);

        uint256 pot = CONTRIBUTION * MAX_MEMBERS;
        uint256 aliceBefore = token.balanceOf(alice);

        vm.expectEmit(true, true, false, true);
        emit PayoutSent(alice, 0, pot);
        circle.triggerPayout();

        assertEq(token.balanceOf(alice) - aliceBefore, pot, "alice receives full pot");
        assertEq(circle.currentCycle(), 1, "cycle counter increments");
        assertTrue(circle.hasReceivedPayout(alice), "alice payout flag set");
    }

    /**
     * @notice Run all 3 cycles. Verify each member receives exactly once, in join order.
     */
    function test_PayoutRotation() public {
        (MockGDollar token, AjoCircle circle, address alice, address bob, address carol) =
            _fullSetup();

        // ── Cycle 0 → alice ───────────────────────────────────────────────────
        _contribute(alice, circle);
        _contribute(bob,   circle);
        _contribute(carol, circle);
        vm.warp(block.timestamp + CYCLE + 1);

        uint256 pot = CONTRIBUTION * MAX_MEMBERS;
        uint256 snap = token.balanceOf(alice);
        circle.triggerPayout();
        assertEq(token.balanceOf(alice) - snap, pot, "cycle 0: alice receives");

        // ── Cycle 1 → bob ─────────────────────────────────────────────────────
        _contribute(alice, circle);
        _contribute(bob,   circle);
        _contribute(carol, circle);
        vm.warp(block.timestamp + CYCLE + 1);

        snap = token.balanceOf(bob);
        circle.triggerPayout();
        assertEq(token.balanceOf(bob) - snap, pot, "cycle 1: bob receives");

        // ── Cycle 2 → carol ───────────────────────────────────────────────────
        _contribute(alice, circle);
        _contribute(bob,   circle);
        _contribute(carol, circle);
        vm.warp(block.timestamp + CYCLE + 1);

        snap = token.balanceOf(carol);
        circle.triggerPayout();
        assertEq(token.balanceOf(carol) - snap, pot, "cycle 2: carol receives");

        // ── All members paid exactly once ─────────────────────────────────────
        assertTrue(circle.hasReceivedPayout(alice), "alice flagged");
        assertTrue(circle.hasReceivedPayout(bob),   "bob flagged");
        assertTrue(circle.hasReceivedPayout(carol),  "carol flagged");
        assertEq(circle.currentCycle(), 3, "3 cycles completed");
    }

    /**
     * @notice Simulated vault yield is included in the payout amount.
     *         Owner mints extra G$ to the vault before triggering payout.
     */
    function test_YieldIncludedInPayout() public {
        (MockGDollar token, MockIdentity identity, AjoFactory factory) = _deployCore();
        AjoYieldVault vault = new AjoYieldVault(address(token), address(0));
        AjoCircle circle = _newCircleWithVault(factory, address(token), address(identity), vault, CONTRIBUTION);

        address alice = makeAddr("alice");
        address bob   = makeAddr("bob");
        address carol = makeAddr("carol");

        uint256 each = CONTRIBUTION * 6;
        _prepareAndJoin(alice, token, identity, circle, each);
        _prepareAndJoin(bob,   token, identity, circle, each);
        _prepareAndJoin(carol, token, identity, circle, each);

        _contribute(alice, circle);
        _contribute(bob,   circle);
        _contribute(carol, circle);

        // Simulate yield: owner sends extra G$ directly to the vault.
        token.mint(address(vault), YIELD_AMOUNT);

        vm.warp(block.timestamp + CYCLE + 1);

        uint256 aliceBefore = token.balanceOf(alice);

        vm.expectEmit(true, true, false, true);
        emit PayoutSent(alice, 0, CONTRIBUTION * MAX_MEMBERS + YIELD_AMOUNT);
        circle.triggerPayout();

        assertEq(
            token.balanceOf(alice) - aliceBefore,
            CONTRIBUTION * MAX_MEMBERS + YIELD_AMOUNT,
            "payout must include simulated yield"
        );
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Access-control tests
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice joinCircle reverts when the identity contract returns false.
     */
    function test_CannotJoinIfNotVerified() public {
        (MockGDollar token, MockIdentity identity, AjoFactory factory) = _deployCore();
        AjoCircle circle = _newCircle(factory, address(token), address(identity), CONTRIBUTION);

        address eve = makeAddr("eve");
        // identity.setWhitelisted(eve, true) intentionally omitted → defaults to false
        token.mint(eve, CONTRIBUTION * 6);
        vm.prank(eve);
        token.approve(address(circle), type(uint256).max);

        vm.prank(eve);
        vm.expectRevert(AjoCircle.IdentityNotVerified.selector);
        circle.joinCircle();
    }

    /**
     * @notice A 4th joinCircle call on a 3-member circle reverts with CircleFull.
     */
    function test_CannotJoinIfFull() public {
        (, AjoCircle circle, address alice, address bob, address carol) = _fullSetup();

        // alice, bob, carol already joined — circle is at capacity
        address dave = makeAddr("dave");

        // Obtain the MockGDollar and MockIdentity used in _fullSetup via the circle.
        MockGDollar token    = MockGDollar(circle.gDollarToken());

        token.mint(dave, CONTRIBUTION * 6);
        vm.startPrank(dave);
        token.approve(address(circle), type(uint256).max);
        vm.expectRevert(AjoCircle.CircleFull.selector);
        circle.joinCircle();
        vm.stopPrank();

        // Suppress unused-variable warnings.
        (alice, bob, carol);
    }

    /**
     * @notice A second contribute call in the same cycle reverts with AlreadyContributed.
     */
    function test_CannotContributeTwice() public {
        (, AjoCircle circle, address alice,,) = _fullSetup();

        _contribute(alice, circle);

        vm.prank(alice);
        vm.expectRevert(AjoCircle.AlreadyContributed.selector);
        circle.contribute();
    }

    /**
     * @notice triggerPayout reverts before the cycle duration has elapsed.
     */
    function test_CannotTriggerPayoutEarly() public {
        (, AjoCircle circle, address alice, address bob, address carol) = _fullSetup();

        _contribute(alice, circle);
        _contribute(bob,   circle);
        _contribute(carol, circle);

        // Do NOT warp — cycle has not ended.
        vm.expectRevert(AjoCircle.CycleNotEnded.selector);
        circle.triggerPayout();
    }

    /**
     * @notice An address not in approvedCircles cannot call AjoYieldVault.deposit.
     */
    function test_OnlyApprovedCircleCanDepositToVault() public {
        (MockGDollar token,,) = _deployCore();
        AjoYieldVault vault = new AjoYieldVault(address(token), address(0));

        address intruder = makeAddr("intruder");
        token.mint(intruder, CONTRIBUTION);
        vm.startPrank(intruder);
        token.approve(address(vault), CONTRIBUTION);
        vm.expectRevert(AjoYieldVault.NotApprovedCircle.selector);
        vault.deposit(CONTRIBUTION);
        vm.stopPrank();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Default / slash tests
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice A member who misses their contribution has their collateral zeroed.
     *         Verifies CollateralSlashed event and collateral mapping reset.
     */
    function test_CollateralSlashedOnDefault() public {
        (, AjoCircle circle,,, address carol) = _setupOneDefaulter();

        uint256 carolCollateral = _collateral(CONTRIBUTION);
        assertGt(circle.collateral(carol), 0, "carol should have collateral before payout");

        vm.expectEmit(true, false, false, true);
        emit CollateralSlashed(carol, carolCollateral);
        circle.triggerPayout();

        assertEq(circle.collateral(carol), 0, "carol collateral must be zeroed after slash");
    }

    /**
     * @notice After slashing, the defaulter's isMember flag is cleared.
     */
    function test_DefaulterRemoved() public {
        (, AjoCircle circle,, , address carol) = _setupOneDefaulter();

        assertTrue(circle.isMember(carol), "carol is a member before payout");

        vm.expectEmit(true, false, false, false);
        emit MemberRemoved(carol);
        circle.triggerPayout();

        assertFalse(circle.isMember(carol), "carol should no longer be a member");
        assertEq(circle.activeMemberCount(), 2, "active count should drop to 2");
    }

    /**
     * @notice Slashed collateral is distributed pro-rata to the two compliant members.
     *         alice = payout recipient, so she gains pot + slash share.
     *         bob is compliant but not recipient, so he gains only slash share.
     */
    function test_SlashDistributed() public {
        (MockGDollar token, AjoCircle circle, address alice, address bob, address carol) =
            _setupOneDefaulter();

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore   = token.balanceOf(bob);

        circle.triggerPayout();

        uint256 carolCollateral = _collateral(CONTRIBUTION);
        uint256 slashShare      = carolCollateral / 2; // 2 compliant members
        uint256 pot             = CONTRIBUTION * 2;    // only alice and bob contributed

        assertEq(
            token.balanceOf(alice) - aliceBefore,
            pot + slashShare,
            "alice gets pot (recipient) + slash share"
        );
        assertEq(
            token.balanceOf(bob) - bobBefore,
            slashShare,
            "bob gets slash share only"
        );

        // carol's collateral: verify via the collateral mapping
        assertEq(circle.collateral(carol), 0, "carol collateral should be gone");
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Edge-case tests
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice With one defaulter, the payout still executes correctly:
     *         pot = 2 × CONTRIBUTION (only compliant contributions), carol removed.
     */
    function test_CircleWithOneDefaulter() public {
        (MockGDollar token, AjoCircle circle, address alice,, address carol) =
            _setupOneDefaulter();

        uint256 aliceBefore = token.balanceOf(alice);
        circle.triggerPayout();

        uint256 carolCollateral = _collateral(CONTRIBUTION);
        uint256 slashShare = carolCollateral / 2;
        uint256 pot        = CONTRIBUTION * 2; // alice + bob contributed

        assertEq(
            token.balanceOf(alice) - aliceBefore,
            pot + slashShare,
            "payout proceeds despite defaulter"
        );
        assertFalse(circle.isMember(carol), "defaulter removed from circle");
        assertEq(circle.currentCycle(), 1, "cycle should still advance");
    }

    /**
     * @notice A circle that never fills (cycleStartTime == 0) reverts on triggerPayout.
     */
    function test_EmptyCircleNeverPays() public {
        (MockGDollar token, MockIdentity identity, AjoFactory factory) = _deployCore();
        AjoCircle circle = _newCircle(factory, address(token), address(identity), CONTRIBUTION);

        // Only alice joins — circle is not full, cycleStartTime stays 0.
        address alice = makeAddr("alice");
        _prepareAndJoin(alice, token, identity, circle, CONTRIBUTION * 6);

        assertEq(circle.cycleStartTime(), 0, "cycle should not have started");

        vm.expectRevert(AjoCircle.CircleNotStarted.selector);
        circle.triggerPayout();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Fuzz test
    // ═══════════════════════════════════════════════════════════════════════════

    /**
     * @notice For any valid contribution amount, the payout equals 3× that amount
     *         when all members contribute and no slashing occurs.
     */
    function testFuzz_ContributionAmount(uint256 amount) public {
        amount = bound(amount, 1e18, 1000e18);

        (MockGDollar token, MockIdentity identity, AjoFactory factory) = _deployCore();
        AjoCircle circle = _newCircle(factory, address(token), address(identity), amount);

        address alice = makeAddr("alice_fuzz");
        address bob   = makeAddr("bob_fuzz");
        address carol = makeAddr("carol_fuzz");

        uint256 each = amount * 6; // generous mint: covers collateral + multiple cycles
        _prepareAndJoin(alice, token, identity, circle, each);
        _prepareAndJoin(bob,   token, identity, circle, each);
        _prepareAndJoin(carol, token, identity, circle, each);

        _contribute(alice, circle);
        _contribute(bob,   circle);
        _contribute(carol, circle);

        vm.warp(block.timestamp + CYCLE + 1);

        uint256 aliceBefore = token.balanceOf(alice);
        circle.triggerPayout();

        assertEq(
            token.balanceOf(alice) - aliceBefore,
            amount * MAX_MEMBERS,
            "fuzz: payout must equal 3x contribution"
        );
    }
}
