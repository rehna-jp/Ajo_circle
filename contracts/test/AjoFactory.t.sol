// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {AjoFactory} from "../src/AjoFactory.sol";
import {AjoCircle} from "../src/AjoCircle.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal mintable token — reuses the same helper as AjoCircle.t.sol.
contract MockGDollar is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AjoFactoryTest is Test {
    AjoFactory public factory;
    MockGDollar public token;

    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");

    uint256 internal constant CONTRIBUTION = 100e18;
    uint256 internal constant CYCLE = 7 days;
    uint256 internal constant MAX_MEMBERS = 3;

    // Mirror the factory event so vm.expectEmit can match it.
    event CircleCreated(
        address indexed circleAddress,
        address indexed creator,
        string name,
        uint256 contributionAmount,
        uint256 maxMembers
    );

    function setUp() public {
        factory = new AjoFactory();
        token = new MockGDollar();
    }

    // ─── test_CreateCircle ────────────────────────────────────────────────────

    /**
     * @notice Verify that createCircle:
     *   - emits CircleCreated with the correct creator and data fields,
     *   - stores the address in allCircles, and
     *   - increments the circle count to 1.
     */
    function test_CreateCircle() public {
        vm.prank(alice);

        // circleAddress is unknown before deployment, so skip topic-1 check.
        vm.expectEmit(false, true, false, true);
        emit CircleCreated(address(0), alice, "Ajo One", CONTRIBUTION, MAX_MEMBERS);

        address circle = factory.createCircle(
            "Ajo One",
            CONTRIBUTION,
            MAX_MEMBERS,
            CYCLE,
            address(token),
            address(0),
            address(0)
        );

        // Returned address is a live contract.
        assertTrue(circle != address(0), "circle should be non-zero");
        assertGt(circle.code.length, 0, "circle should have bytecode");

        // Registered in allCircles.
        assertEq(factory.allCircles(0), circle, "allCircles[0] mismatch");

        // Count reflects one deployment.
        assertEq(factory.getCircleCount(), 1, "count should be 1");
    }

    // ─── test_GetUserCircles ──────────────────────────────────────────────────

    /**
     * @notice Verify that userCircles is updated for the creator and remains
     *         empty for any other address.
     */
    function test_GetUserCircles() public {
        vm.prank(alice);
        address circle = factory.createCircle(
            "Alice's Circle",
            CONTRIBUTION,
            MAX_MEMBERS,
            CYCLE,
            address(token),
            address(0),
            address(0)
        );

        address[] memory aliceCircles = factory.getUserCircles(alice);
        assertEq(aliceCircles.length, 1, "alice should have 1 circle");
        assertEq(aliceCircles[0], circle, "wrong circle address for alice");

        // Bob never created a circle — mapping should be empty.
        assertEq(factory.getUserCircles(bob).length, 0, "bob should have 0 circles");
    }

    // ─── test_MultipleCircles ─────────────────────────────────────────────────

    /**
     * @notice Create 3 circles from different callers and verify getAllCircles
     *         returns all three addresses in deployment order.
     */
    function test_MultipleCircles() public {
        vm.prank(alice);
        address c1 = factory.createCircle(
            "Circle 1", CONTRIBUTION, MAX_MEMBERS, CYCLE, address(token), address(0), address(0)
        );

        vm.prank(bob);
        address c2 = factory.createCircle(
            "Circle 2", CONTRIBUTION, MAX_MEMBERS, CYCLE, address(token), address(0), address(0)
        );

        vm.prank(carol);
        address c3 = factory.createCircle(
            "Circle 3", CONTRIBUTION, MAX_MEMBERS, CYCLE, address(token), address(0), address(0)
        );

        address[] memory all = factory.getAllCircles();
        assertEq(all.length, 3, "should have 3 circles total");
        assertEq(all[0], c1, "all[0] mismatch");
        assertEq(all[1], c2, "all[1] mismatch");
        assertEq(all[2], c3, "all[2] mismatch");

        assertEq(factory.getCircleCount(), 3, "count should be 3");

        // Each creator has exactly their own circle.
        assertEq(factory.getUserCircles(alice)[0], c1);
        assertEq(factory.getUserCircles(bob)[0], c2);
        assertEq(factory.getUserCircles(carol)[0], c3);
    }
}
