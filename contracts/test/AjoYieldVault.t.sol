// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {AjoYieldVault} from "../src/AjoYieldVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal mintable G$ stand-in — identical to the helper used in other test files.
contract MockGDollar is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AjoYieldVaultTest is Test {
    AjoYieldVault public vault;
    MockGDollar public token;

    // Test contract is the Ownable owner (deploys vault in setUp without pranking).
    address internal circle = makeAddr("circle");
    address internal alice = makeAddr("alice");

    uint256 internal constant DEPOSIT = 1_000e18;
    uint256 internal constant YIELD = 50e18;

    // Mirror vault events for vm.expectEmit.
    event Deposited(address indexed circle, uint256 amount);
    event Withdrawn(address indexed circle, uint256 amount, uint256 yield);

    function setUp() public {
        token = new MockGDollar();
        // No router — demo mode (hold G$ in vault).
        vault = new AjoYieldVault(address(token), address(0));

        token.mint(circle, 10_000e18);

        // Circle pre-approves vault so deposit() can pull tokens.
        vm.prank(circle);
        token.approve(address(vault), type(uint256).max);
    }

    // ─── test_Deposit ─────────────────────────────────────────────────────────

    /**
     * @notice An approved circle can deposit; state and event are updated correctly.
     *         An unapproved address calling deposit is covered by test_UnauthorizedDeposit.
     */
    function test_Deposit() public {
        vault.approveCircle(circle); // owner (this contract) approves

        vm.expectEmit(true, false, false, true);
        emit Deposited(circle, DEPOSIT);

        vm.prank(circle);
        vault.deposit(DEPOSIT);

        assertEq(vault.totalDeposited(), DEPOSIT, "totalDeposited should equal DEPOSIT");
        assertEq(token.balanceOf(address(vault)), DEPOSIT, "vault balance should equal DEPOSIT");
    }

    // ─── test_WithdrawAll ─────────────────────────────────────────────────────

    /**
     * @notice withdrawAll returns the exact deposited amount, resets totalDeposited to 0,
     *         and transfers G$ back to the circle.
     */
    function test_WithdrawAll() public {
        vault.approveCircle(circle);

        vm.prank(circle);
        vault.deposit(DEPOSIT);

        uint256 circleBefore = token.balanceOf(circle);

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(circle, DEPOSIT, 0); // no yield in this path

        vm.prank(circle);
        uint256 withdrawn = vault.withdrawAll();

        assertEq(withdrawn, DEPOSIT, "should return deposited amount");
        assertEq(vault.totalDeposited(), 0, "totalDeposited should reset to 0");
        assertEq(
            token.balanceOf(circle),
            circleBefore + DEPOSIT,
            "circle should receive its G$ back"
        );
        assertEq(token.balanceOf(address(vault)), 0, "vault should be empty after withdrawal");
    }

    // ─── test_GetAccruedYield ─────────────────────────────────────────────────

    /**
     * @notice getAccruedYield returns 0 when vault holds only principal,
     *         and the simulated-yield amount when extra G$ is present.
     *         Also verifies withdrawAll returns principal + yield and emits the correct yield.
     */
    function test_GetAccruedYield() public {
        vault.approveCircle(circle);

        vm.prank(circle);
        vault.deposit(DEPOSIT);

        // No yield yet — balance equals principal.
        assertEq(vault.getAccruedYield(), 0, "yield should be 0 before simulation");

        // Simulate yield: owner mints extra G$ directly to the vault.
        token.mint(address(vault), YIELD);

        assertEq(vault.getAccruedYield(), YIELD, "yield should equal simulated amount");

        // withdrawAll should return principal + yield and emit the correct yield component.
        uint256 circleBefore = token.balanceOf(circle);

        vm.expectEmit(true, false, false, true);
        emit Withdrawn(circle, DEPOSIT + YIELD, YIELD);

        vm.prank(circle);
        uint256 withdrawn = vault.withdrawAll();

        assertEq(withdrawn, DEPOSIT + YIELD, "withdrawn amount should include yield");
        assertEq(token.balanceOf(circle), circleBefore + DEPOSIT + YIELD, "circle balance wrong");
        assertEq(vault.totalDeposited(), 0, "totalDeposited should reset after withdrawal");
    }

    // ─── test_UnauthorizedDeposit ─────────────────────────────────────────────

    /**
     * @notice Any address that has not been whitelisted via approveCircle reverts on deposit.
     */
    function test_UnauthorizedDeposit() public {
        token.mint(alice, DEPOSIT);
        vm.prank(alice);
        token.approve(address(vault), DEPOSIT);

        vm.prank(alice);
        vm.expectRevert(AjoYieldVault.NotApprovedCircle.selector);
        vault.deposit(DEPOSIT);
    }

    // ─── test_UnauthorizedWithdraw ────────────────────────────────────────────

    /**
     * @notice An unapproved address also cannot call withdrawAll.
     */
    function test_UnauthorizedWithdraw() public {
        vm.prank(alice);
        vm.expectRevert(AjoYieldVault.NotApprovedCircle.selector);
        vault.withdrawAll();
    }

    // ─── test_ApproveCircle_OnlyOwner ─────────────────────────────────────────

    /**
     * @notice Non-owner cannot whitelist circles.
     */
    function test_ApproveCircle_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert(); // OwnableUnauthorizedAccount from OZ Ownable
        vault.approveCircle(circle);
    }
}
