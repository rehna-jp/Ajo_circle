// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title AjoYieldVault
 * @notice Holds pooled G$ contributions between deposit and payout, earning yield
 *         via Ubeswap liquidity provision on Celo.
 * @dev    Only whitelisted AjoCircle contracts may deposit and withdraw.
 *         One vault is intended to serve one circle at a time; the full G$ balance
 *         is returned on withdrawal so principal + yield flows back to the circle.
 *
 *         Demo mode: when `ubeswapRouter` is address(0), G$ is held directly in this
 *         contract. The owner can simulate yield by sending extra G$ to this address
 *         before a payout is triggered.
 */
contract AjoYieldVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────────

    address public gDollarToken;
    address public ubeswapRouter;
    uint256 public totalDeposited;
    mapping(address => bool) public approvedCircles;

    // ─── Events ──────────────────────────────────────────────────────────────

    /// @notice Emitted when an AjoCircle is whitelisted.
    event CircleApproved(address indexed circle);

    /**
     * @notice Emitted when a circle deposits G$ into this vault.
     * @param circle Address of the depositing AjoCircle.
     * @param amount G$ amount deposited.
     */
    event Deposited(address indexed circle, uint256 amount);

    /**
     * @notice Emitted when a circle withdraws its full position.
     * @param circle    Address of the withdrawing AjoCircle.
     * @param amount    Total G$ transferred (principal + yield).
     * @param yield     Amount above the deposited principal (0 if no yield accrued).
     */
    event Withdrawn(address indexed circle, uint256 amount, uint256 yield);

    // ─── Errors ──────────────────────────────────────────────────────────────

    error NotApprovedCircle();
    error ZeroAddress();

    // ─── Modifier ────────────────────────────────────────────────────────────

    /// @dev Reverts if the caller is not a whitelisted AjoCircle.
    modifier onlyApprovedCircle() {
        if (!approvedCircles[msg.sender]) revert NotApprovedCircle();
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────────

    /**
     * @notice Deploy the vault. Deployer becomes the owner.
     * @param _gDollarToken  G$ ERC-20 token address on Celo (non-zero).
     * @param _ubeswapRouter Ubeswap V2 router address; address(0) disables LP provision.
     */
    constructor(address _gDollarToken, address _ubeswapRouter) Ownable(msg.sender) {
        if (_gDollarToken == address(0)) revert ZeroAddress();
        gDollarToken = _gDollarToken;
        ubeswapRouter = _ubeswapRouter;
    }

    // ─── Owner functions ─────────────────────────────────────────────────────

    /**
     * @notice Whitelist an AjoCircle contract so it may call {deposit} and {withdrawAll}.
     * @dev    In production this would be called by the AjoFactory immediately after
     *         deploying a new circle, provided the factory holds vault ownership.
     * @param circle Address of the AjoCircle to approve (non-zero).
     */
    function approveCircle(address circle) external onlyOwner {
        if (circle == address(0)) revert ZeroAddress();
        approvedCircles[circle] = true;
        emit CircleApproved(circle);
    }

    // ─── Circle functions ─────────────────────────────────────────────────────

    /**
     * @notice Pull G$ from the calling circle and deploy it for yield.
     * @dev    The circle must call `IERC20(gDollarToken).approve(vault, amount)` before
     *         this function (done automatically by AjoCircle.contribute via forceApprove).
     *
     *         Increments `totalDeposited` then attempts Ubeswap LP provision.
     *         Falls back to holding G$ when `ubeswapRouter` is address(0).
     *
     * TODO — Ubeswap G$/cUSD liquidity provision (replace the hold-in-place logic):
     *
     *   When `ubeswapRouter != address(0)`, pair the deposited G$ with cUSD and add
     *   liquidity to the Ubeswap G$/cUSD pool so the vault earns trading fees:
     *
     *   1. Query the pool to find the optimal cUSD amount to pair with `amount` of G$:
     *        address factory = IUniswapV2Router02(ubeswapRouter).factory();
     *        address pair    = IUniswapV2Factory(factory).getPair(gDollarToken, CUSD);
     *        (uint112 r0, uint112 r1,) = IUniswapV2Pair(pair).getReserves();
     *        uint256 cUSDRequired = IUniswapV2Router02(ubeswapRouter)
     *            .quote(amount, r0, r1);
     *
     *   2. Approve both tokens and call addLiquidity:
     *        IERC20(gDollarToken).forceApprove(ubeswapRouter, amount);
     *        IERC20(CUSD).forceApprove(ubeswapRouter, cUSDRequired);
     *        IUniswapV2Router02(ubeswapRouter).addLiquidity(
     *            gDollarToken,
     *            CUSD,
     *            amount,
     *            cUSDRequired,
     *            (amount       * 995) / 1000,   // 0.5 % G$   slippage
     *            (cUSDRequired * 995) / 1000,   // 0.5 % cUSD slippage
     *            address(this),
     *            block.timestamp + 300
     *        );
     *
     *   Track LP tokens received in an `lpBalance` state variable for use in {withdrawAll}.
     *
     *   For the demo, G$ is held in this contract and the owner may send extra G$ directly
     *   to this address to simulate accrued yield before a payout is triggered.
     *
     * @param amount G$ amount to deposit.
     */
    function deposit(uint256 amount) external onlyApprovedCircle nonReentrant {
        IERC20(gDollarToken).safeTransferFrom(msg.sender, address(this), amount);
        totalDeposited += amount;

        // Demo: G$ is held here. Replace with Ubeswap addLiquidity when router is set.

        emit Deposited(msg.sender, amount);
    }

    /**
     * @notice Withdraw all G$ (principal + accrued yield) to the calling circle.
     * @dev    Reads the full G$ balance of this vault, resets `totalDeposited`, then
     *         transfers everything to the caller. The circle passes the returned amount
     *         on to the payout recipient.
     *
     * TODO — Ubeswap liquidity removal (prepend before the balance transfer):
     *
     *   When `ubeswapRouter != address(0)` and LP tokens are held:
     *
     *   1. Approve the router for the full LP balance:
     *        address lpToken = IUniswapV2Factory(
     *            IUniswapV2Router02(ubeswapRouter).factory()
     *        ).getPair(gDollarToken, CUSD);
     *        uint256 lpBalance = IERC20(lpToken).balanceOf(address(this));
     *        IERC20(lpToken).forceApprove(ubeswapRouter, lpBalance);
     *
     *   2. Remove all liquidity, receiving G$ and cUSD back to this vault:
     *        IUniswapV2Router02(ubeswapRouter).removeLiquidity(
     *            gDollarToken,
     *            CUSD,
     *            lpBalance,
     *            0, 0,               // accept any return (vault is sole LP)
     *            address(this),
     *            block.timestamp + 300
     *        );
     *
     *   3. Swap any cUSD received back to G$ so the circle receives a single token:
     *        address[] memory path = new address[](2);
     *        path[0] = CUSD; path[1] = gDollarToken;
     *        IERC20(CUSD).forceApprove(ubeswapRouter, IERC20(CUSD).balanceOf(address(this)));
     *        IUniswapV2Router02(ubeswapRouter).swapExactTokensForTokens(
     *            IERC20(CUSD).balanceOf(address(this)),
     *            0,
     *            path,
     *            address(this),
     *            block.timestamp + 300
     *        );
     *
     *   After the swap, the full G$ balance (principal + trading fees + price delta) is
     *   available for transfer to `msg.sender` in the block below.
     *
     * @return total G$ transferred to the caller (principal + yield).
     */
    function withdrawAll() external onlyApprovedCircle nonReentrant returns (uint256 total) {
        total = IERC20(gDollarToken).balanceOf(address(this));
        uint256 yieldAmount = total > totalDeposited ? total - totalDeposited : 0;

        // Effects before interaction.
        totalDeposited = 0;

        // Demo: transfer full G$ balance. Replace with Ubeswap removal when router is set.
        if (total > 0) {
            IERC20(gDollarToken).safeTransfer(msg.sender, total);
        }

        emit Withdrawn(msg.sender, total, yieldAmount);
    }

    // ─── View functions ───────────────────────────────────────────────────────

    /**
     * @notice G$ earned above the deposited principal.
     * @dev    In demo mode, this reflects extra G$ sent directly to the vault address.
     *         With Ubeswap enabled, it reflects unrealised LP fees; realised yield is
     *         only known after {withdrawAll} calls removeLiquidity.
     * @return yield Amount of G$ held above `totalDeposited`; 0 if balance ≤ principal.
     */
    function getAccruedYield() external view returns (uint256 yield) {
        uint256 balance = IERC20(gDollarToken).balanceOf(address(this));
        yield = balance > totalDeposited ? balance - totalDeposited : 0;
    }
}
