// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title IIdentity
 * @notice Minimal interface for the GoodDollar identity registry deployed on Celo.
 *         AjoCircle calls `isWhitelisted` during `joinCircle` to ensure every member
 *         holds a verified GoodDollar UBI identity before they can participate.
 * @dev Full protocol source: https://github.com/GoodDollar/GoodProtocol
 *      Alfajores identity contract: confirm address via GoodDollar docs before deploying.
 */
interface IIdentity {
    /**
     * @notice Returns true when `account` is whitelisted in the GoodDollar identity registry.
     * @param account Address to check.
     * @return        True if the address holds a verified GoodDollar identity.
     */
    function isWhitelisted(address account) external view returns (bool);
}
