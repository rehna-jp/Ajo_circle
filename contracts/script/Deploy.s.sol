// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {AjoCircle} from "../src/AjoCircle.sol";

/**
 * @notice Deploy AjoCircle to Celo Alfajores.
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   export CELOSCAN_API_KEY=...   # optional, for verification
 *
 *   forge script script/Deploy.s.sol \
 *     --rpc-url celo_alfajores \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 */
contract DeployAjoCircle is Script {
    function run() external returns (AjoCircle ajo) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("Deploying AjoCircle");
        console.log("  Deployer :", deployer);
        console.log("  Chain ID :", block.chainid);

        vm.startBroadcast(deployerKey);
        ajo = new AjoCircle();
        vm.stopBroadcast();

        console.log("AjoCircle deployed at:", address(ajo));
    }
}
