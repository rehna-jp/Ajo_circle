// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AjoCircle} from "./AjoCircle.sol";
import {AjoYieldVault} from "./AjoYieldVault.sol";

/**
 * @title AjoFactory
 * @notice Deploys and tracks individual AjoCircle ROSCA instances on Celo.
 *         Each call to {createCircle} deploys a fresh AjoCircle contract via its
 *         constructor, then registers the address in the global list and the
 *         caller's personal list.
 */
contract AjoFactory {
    // ─── State ───────────────────────────────────────────────────────────────

    /// @notice Every AjoCircle contract address deployed through this factory,
    ///         in chronological order.
    address[] public allCircles;

    /// @notice Maps a creator address to the list of circle contracts they
    ///         deployed via this factory.
    mapping(address => address[]) public userCircles;

    // ─── Events ──────────────────────────────────────────────────────────────

    /**
     * @notice Emitted immediately before {createCircle} returns.
     * @param circleAddress      Address of the freshly deployed AjoCircle.
     * @param creator            Address that called {createCircle}.
     * @param name               Human-readable circle name.
     * @param contributionAmount Per-round contribution amount in token wei.
     * @param maxMembers         Maximum seats in the circle.
     */
    event CircleCreated(
        address indexed circleAddress,
        address indexed creator,
        string name,
        uint256 contributionAmount,
        uint256 maxMembers
    );

    // ─── Functions ───────────────────────────────────────────────────────────

    /**
     * @notice Deploy a new AjoCircle, initialise it, register it in the
     *         factory's registry, emit {CircleCreated}, and return its address.
     * @param name               Human-readable name for the savings circle.
     * @param contributionAmount Amount each member contributes per round (token wei).
     * @param maxMembers         Maximum number of members allowed (2–20).
     * @param cycleDuration      Suggested round length in seconds (≥ 1 day).
     * @param gDollarToken       G$ ERC-20 token (e.g. G$ on Celo) used for contributions.
     * @param yieldVault         ERC-4626 vault for idle fund yield; address(0) to disable.
     * @param identityContract   GoodDollar identity contract; address(0) to skip KYC.
     * @return circleAddress     Address of the newly deployed AjoCircle contract.
     */
    function createCircle(
        string calldata name,
        uint256 contributionAmount,
        uint256 maxMembers,
        uint256 cycleDuration,
        address gDollarToken,
        address yieldVault,
        address identityContract
    ) external returns (address circleAddress) {
        AjoCircle circle = new AjoCircle(
            name,
            contributionAmount,
            maxMembers,
            cycleDuration,
            gDollarToken,
            yieldVault,
            identityContract,
            msg.sender
        );

        circleAddress = address(circle);
        allCircles.push(circleAddress);
        userCircles[msg.sender].push(circleAddress);

        if (yieldVault != address(0)) {
            AjoYieldVault(yieldVault).approveCircle(circleAddress);
        }

        emit CircleCreated(circleAddress, msg.sender, name, contributionAmount, maxMembers);
    }

    /**
     * @notice Return every circle deployed through this factory in order.
     * @return Array of AjoCircle contract addresses.
     */
    function getAllCircles() external view returns (address[] memory) {
        return allCircles;
    }

    /**
     * @notice Return all circles that `user` created via this factory.
     * @param user Address to look up.
     * @return     Array of AjoCircle addresses owned by `user`.
     */
    function getUserCircles(address user) external view returns (address[] memory) {
        return userCircles[user];
    }

    /**
     * @notice Total number of circles deployed through this factory.
     * @return Length of the `allCircles` array.
     */
    function getCircleCount() external view returns (uint256) {
        return allCircles.length;
    }
}
