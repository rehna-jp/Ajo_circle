// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {AjoCircle} from "../src/AjoCircle.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// Minimal mintable token for tests
contract MockGDollar is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AjoCircleTest is Test {
    AjoCircle public ajo;
    MockGDollar public token;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant CONTRIBUTION = 100e18;
    uint256 internal constant ROUND_DURATION = 7 days;
    uint256 internal constant MAX_MEMBERS = 3;

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

    function setUp() public {
        ajo = new AjoCircle();
        token = new MockGDollar();

        token.mint(alice, 10_000e18);
        token.mint(bob, 10_000e18);
        token.mint(carol, 10_000e18);

        vm.prank(alice);
        token.approve(address(ajo), type(uint256).max);
        vm.prank(bob);
        token.approve(address(ajo), type(uint256).max);
        vm.prank(carol);
        token.approve(address(ajo), type(uint256).max);
    }

    // ─── createCircle ─────────────────────────────────────────────────────────

    function test_CreateCircle_StoresCorrectState() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CircleCreated(0, alice, address(token), CONTRIBUTION, MAX_MEMBERS, ROUND_DURATION);
        uint256 id = ajo.createCircle(address(token), CONTRIBUTION, MAX_MEMBERS, ROUND_DURATION);

        AjoCircle.CircleView memory c = ajo.getCircle(id);
        assertEq(c.creator, alice);
        assertEq(c.token, address(token));
        assertEq(c.contributionAmount, CONTRIBUTION);
        assertEq(c.maxMembers, MAX_MEMBERS);
        assertEq(c.roundDuration, ROUND_DURATION);
        assertEq(c.members.length, 1);
        assertEq(c.members[0], alice);
        assertEq(uint8(c.status), uint8(AjoCircle.Status.Open));
        assertTrue(ajo.isMember(id, alice));
    }

    function test_CreateCircle_IncrementsCircleCount() public {
        vm.startPrank(alice);
        ajo.createCircle(address(token), CONTRIBUTION, MAX_MEMBERS, ROUND_DURATION);
        ajo.createCircle(address(token), CONTRIBUTION, MAX_MEMBERS, ROUND_DURATION);
        vm.stopPrank();
        assertEq(ajo.circleCount(), 2);
    }

    function test_CreateCircle_RevertZeroToken() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AjoCircle.InvalidParam.selector, "zero token"));
        ajo.createCircle(address(0), CONTRIBUTION, MAX_MEMBERS, ROUND_DURATION);
    }

    function test_CreateCircle_RevertZeroContribution() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AjoCircle.InvalidParam.selector, "zero contribution"));
        ajo.createCircle(address(token), 0, MAX_MEMBERS, ROUND_DURATION);
    }

    function test_CreateCircle_RevertInvalidMaxMembers() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AjoCircle.InvalidParam.selector, "maxMembers 2-20"));
        ajo.createCircle(address(token), CONTRIBUTION, 1, ROUND_DURATION);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(AjoCircle.InvalidParam.selector, "maxMembers 2-20"));
        ajo.createCircle(address(token), CONTRIBUTION, 21, ROUND_DURATION);
    }

    function test_CreateCircle_RevertShortRoundDuration() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AjoCircle.InvalidParam.selector, "roundDuration >= 1 day")
        );
        ajo.createCircle(address(token), CONTRIBUTION, MAX_MEMBERS, 12 hours);
    }

    // ─── joinCircle ───────────────────────────────────────────────────────────

    function test_JoinCircle_AddsNewMember() public {
        uint256 id = _createCircle(alice);

        vm.prank(bob);
        vm.expectEmit(true, true, false, false);
        emit MemberJoined(id, bob);
        ajo.joinCircle(id);

        assertTrue(ajo.isMember(id, bob));
        assertEq(ajo.getCircle(id).members.length, 2);
    }

    function test_JoinCircle_RevertAlreadyMember() public {
        uint256 id = _createCircle(alice);

        vm.prank(alice);
        vm.expectRevert(AjoCircle.AlreadyMember.selector);
        ajo.joinCircle(id);
    }

    function test_JoinCircle_RevertCircleFull() public {
        uint256 id = _createCircle(alice);
        vm.prank(bob);
        ajo.joinCircle(id);
        vm.prank(carol);
        ajo.joinCircle(id);

        address dave = makeAddr("dave");
        vm.prank(dave);
        vm.expectRevert(AjoCircle.CircleFull.selector);
        ajo.joinCircle(id);
    }

    function test_JoinCircle_RevertAfterStart() public {
        uint256 id = _createAndStartCircle();

        address dave = makeAddr("dave");
        vm.prank(dave);
        vm.expectRevert(AjoCircle.CircleNotOpen.selector);
        ajo.joinCircle(id);
    }

    // ─── startCircle ──────────────────────────────────────────────────────────

    function test_StartCircle_SetsActiveStatus() public {
        uint256 id = _createCircle(alice);
        vm.prank(bob);
        ajo.joinCircle(id);

        vm.prank(alice);
        ajo.startCircle(id);

        assertEq(uint8(ajo.getCircle(id).status), uint8(AjoCircle.Status.Active));
    }

    function test_StartCircle_RevertNotCreator() public {
        uint256 id = _createCircle(alice);
        vm.prank(bob);
        ajo.joinCircle(id);

        vm.prank(bob);
        vm.expectRevert(AjoCircle.Unauthorized.selector);
        ajo.startCircle(id);
    }

    function test_StartCircle_RevertNeedTwoMembers() public {
        uint256 id = _createCircle(alice);

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(AjoCircle.InvalidParam.selector, "need >= 2 members")
        );
        ajo.startCircle(id);
    }

    // ─── contribute ───────────────────────────────────────────────────────────

    function test_Contribute_TransfersTokens() public {
        uint256 id = _createAndStartCircle();
        uint256 aliceBefore = token.balanceOf(alice);

        vm.prank(alice);
        ajo.contribute(id);

        assertEq(token.balanceOf(alice), aliceBefore - CONTRIBUTION);
        assertEq(token.balanceOf(address(ajo)), CONTRIBUTION);
    }

    function test_Contribute_RevertAlreadyContributed() public {
        uint256 id = _createAndStartCircle();

        vm.prank(alice);
        ajo.contribute(id);

        vm.prank(alice);
        vm.expectRevert(AjoCircle.AlreadyContributed.selector);
        ajo.contribute(id);
    }

    function test_Contribute_RevertNotMember() public {
        uint256 id = _createAndStartCircle();

        address outsider = makeAddr("outsider");
        vm.prank(outsider);
        vm.expectRevert(AjoCircle.NotMember.selector);
        ajo.contribute(id);
    }

    function test_Contribute_RevertCircleNotActive() public {
        uint256 id = _createCircle(alice);
        vm.prank(bob);
        ajo.joinCircle(id);

        vm.prank(alice);
        vm.expectRevert(AjoCircle.CircleNotActive.selector);
        ajo.contribute(id);
    }

    // ─── payout & round rotation ──────────────────────────────────────────────

    function test_FirstRoundPayoutGoesToFirstMember() public {
        uint256 id = _createAndStartCircle();
        // members[0] == alice (creator / first to join)
        uint256 aliceBefore = token.balanceOf(alice);

        _contributeAll(id);

        // Alice should have received payout minus her own contribution
        uint256 expected = aliceBefore - CONTRIBUTION + (CONTRIBUTION * 3);
        assertEq(token.balanceOf(alice), expected);
    }

    function test_RoundsRotateThroughAllMembers() public {
        uint256 id = _createAndStartCircle();

        uint256 aliceBefore = token.balanceOf(alice);
        uint256 bobBefore = token.balanceOf(bob);
        uint256 carolBefore = token.balanceOf(carol);

        // Round 0 → alice receives
        _contributeAll(id);
        // Round 1 → bob receives
        _contributeAll(id);
        // Round 2 → carol receives
        _contributeAll(id);

        uint256 payout = CONTRIBUTION * 3;
        // Each member paid 3 × CONTRIBUTION and received payout once
        assertEq(token.balanceOf(alice), aliceBefore - CONTRIBUTION * 3 + payout);
        assertEq(token.balanceOf(bob), bobBefore - CONTRIBUTION * 3 + payout);
        assertEq(token.balanceOf(carol), carolBefore - CONTRIBUTION * 3 + payout);
    }

    function test_CircleCompletedAfterAllRounds() public {
        uint256 id = _createAndStartCircle();

        _contributeAll(id); // round 0
        _contributeAll(id); // round 1

        // Round 2: set expectation right before the single call that fires CircleCompleted
        vm.prank(alice);
        ajo.contribute(id);
        vm.prank(bob);
        ajo.contribute(id);

        vm.expectEmit(true, false, false, false);
        emit CircleCompleted(id);
        vm.prank(carol);
        ajo.contribute(id);

        assertEq(uint8(ajo.getCircle(id).status), uint8(AjoCircle.Status.Completed));
    }

    function test_ContributeRevertsAfterCircleComplete() public {
        uint256 id = _createAndStartCircle();
        _contributeAll(id);
        _contributeAll(id);
        _contributeAll(id);

        vm.prank(alice);
        vm.expectRevert(AjoCircle.CircleNotActive.selector);
        ajo.contribute(id);
    }

    // ─── distributeRound fallback ─────────────────────────────────────────────

    function test_ManualDistributeRoundWorks() public {
        uint256 id = _createAndStartCircle();
        uint256 aliceBefore = token.balanceOf(alice);

        vm.prank(alice);
        ajo.contribute(id);
        vm.prank(bob);
        ajo.contribute(id);
        vm.prank(carol);
        ajo.contribute(id);

        // Auto-distributed in the last contribute call; round should have advanced
        assertEq(ajo.getCircle(id).currentRound, 1);
        assertGt(token.balanceOf(alice), aliceBefore);
    }

    function test_ManualDistribute_RevertRoundNotComplete() public {
        uint256 id = _createAndStartCircle();

        vm.prank(alice);
        ajo.contribute(id);

        vm.expectRevert(AjoCircle.RoundNotComplete.selector);
        ajo.distributeRound(id);
    }

    // ─── hasContributed & currentRecipient ────────────────────────────────────

    function test_HasContributed_TracksCorrectly() public {
        uint256 id = _createAndStartCircle();
        assertFalse(ajo.hasContributed(id, 0, alice));

        vm.prank(alice);
        ajo.contribute(id);
        assertTrue(ajo.hasContributed(id, 0, alice));
        assertFalse(ajo.hasContributed(id, 0, bob));
    }

    function test_CurrentRecipient_ReturnsZeroWhenNotActive() public {
        uint256 id = _createCircle(alice);
        assertEq(ajo.currentRecipient(id), address(0));
    }

    function test_CurrentRecipient_RotatesEachRound() public {
        uint256 id = _createAndStartCircle();
        address[] memory members = ajo.getCircle(id).members;

        assertEq(ajo.currentRecipient(id), members[0]);
        _contributeAll(id);
        assertEq(ajo.currentRecipient(id), members[1]);
        _contributeAll(id);
        assertEq(ajo.currentRecipient(id), members[2]);
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    function _createCircle(address creator) internal returns (uint256 id) {
        vm.prank(creator);
        id = ajo.createCircle(address(token), CONTRIBUTION, MAX_MEMBERS, ROUND_DURATION);
    }

    function _createAndStartCircle() internal returns (uint256 id) {
        id = _createCircle(alice);

        vm.prank(bob);
        ajo.joinCircle(id);
        vm.prank(carol);
        ajo.joinCircle(id);

        vm.prank(alice);
        ajo.startCircle(id);
    }

    function _contributeAll(uint256 id) internal {
        vm.prank(alice);
        ajo.contribute(id);
        vm.prank(bob);
        ajo.contribute(id);
        vm.prank(carol);
        ajo.contribute(id);
    }
}
