// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {AjoFactory} from "../src/AjoFactory.sol";
import {AjoYieldVault} from "../src/AjoYieldVault.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

// ─── Testnet mock token ───────────────────────────────────────────────────────

/**
 * @dev Minimal mintable G$ stand-in deployed when GDOLLAR_ADDRESS is not set.
 *      Used only on Alfajores / local devnets — never deploy to mainnet.
 */
contract MockGDollar is ERC20 {
    constructor() ERC20("GoodDollar", "G$") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

// ─── Deploy script ────────────────────────────────────────────────────────────

/**
 * @title DeployAjo
 * @notice Deploys AjoYieldVault and AjoFactory to Celo Alfajores (or mainnet).
 *         Writes deployed addresses to deployments/alfajores.json.
 *
 * ─── Token address ────────────────────────────────────────────────────────────
 *   G$ has no official Alfajores deployment. Two options:
 *
 *   a) Let the script deploy a MockGDollar (default — set nothing):
 *      The script detects a missing GDOLLAR_ADDRESS and deploys the mock.
 *
 *   b) Supply a real G$ address via env:
 *      export GDOLLAR_ADDRESS=<address>
 *      Celo mainnet G$: 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A
 *
 * ─── Prerequisites ────────────────────────────────────────────────────────────
 *   export PRIVATE_KEY=0x<deployer-private-key>
 *   export CELOSCAN_API_KEY=<key>   # only needed for --verify
 *
 * ─── Preferred deploy command ─────────────────────────────────────────────────
 *   Uses [rpc_endpoints] and [etherscan] from foundry.toml — --verify resolves
 *   the Celoscan URL automatically.
 *
 *   forge script script/Deploy.s.sol \
 *     --rpc-url celo_alfajores \
 *     --broadcast \
 *     --verify \
 *     -vvvv
 *
 * ─── Alternative (explicit RPC / verifier) ────────────────────────────────────
 *   forge script script/Deploy.s.sol \
 *     --rpc-url $CELO_TESTNET_RPC \
 *     --broadcast \
 *     --verify \
 *     --verifier-url https://api-alfajores.celoscan.io/api \
 *     --etherscan-api-key $CELOSCAN_API_KEY \
 *     -vvvv
 *
 * ─── Post-deployment: approving circles ──────────────────────────────────────
 *   The deployer is set as AjoYieldVault owner. Whenever AjoFactory creates
 *   a new circle, the vault owner must whitelist it:
 *
 *   cast send <AjoYieldVault> "approveCircle(address)" <circleAddress> \
 *     --private-key $PRIVATE_KEY --rpc-url celo_alfajores
 *
 *   In a later upgrade, vault ownership can be transferred to a keeper
 *   or upgraded factory that auto-approves circles on creation.
 */
contract DeployAjo is Script {
    // ── Known addresses ───────────────────────────────────────────────────────

    /// @dev Celo mainnet G$ (verified EIP-55 checksum). Used as default when
    ///      GDOLLAR_ADDRESS env var is set to the mainnet value.
    ///      On Alfajores there is no official G$ — the script deploys MockGDollar.
    address private constant GDOLLAR_MAINNET = 0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A;

    /// @dev Ubeswap V2 Router on Alfajores — address(0) keeps the vault in
    ///      hold mode (no LP provision). Replace for mainnet deployment.
    address private constant UBESWAP_ROUTER = address(0);

    // ── Output paths ──────────────────────────────────────────────────────────

    string private constant DEPLOYMENTS_DIR  = "deployments";
    string private constant DEPLOYMENTS_FILE = "deployments/alfajores.json";

    // ── Entry point ───────────────────────────────────────────────────────────

    /**
     * @notice Deploy all Ajo contracts, persist addresses, and log
     *         Celoscan verification commands.
     * @return vault         Deployed AjoYieldVault.
     * @return factory       Deployed AjoFactory.
     * @return gdollarToken  The G$ token used (real or mock).
     */
    function run()
        external
        returns (
            AjoYieldVault vault,
            AjoFactory factory,
            address gdollarToken
        )
    {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        // Read token address from env; fall back to deploying a mock.
        // vm.envOr returns the env value when set, or address(0) when absent.
        gdollarToken = vm.envOr("GDOLLAR_ADDRESS", address(0));
        bool deployingMock = (gdollarToken == address(0));

        _logHeader(deployer, gdollarToken, deployingMock);

        // ── Broadcast: all new{} calls become on-chain transactions ──────────

        vm.startBroadcast(deployerKey);

        // 0 (optional). Deploy MockGDollar when no real G$ address is provided.
        if (deployingMock) {
            MockGDollar mock = new MockGDollar();
            gdollarToken = address(mock);
            console.log("MockGDollar deployed :", gdollarToken);
        }

        // 1. AjoYieldVault — deployer becomes Ownable owner.
        vault = new AjoYieldVault(gdollarToken, UBESWAP_ROUTER);

        // 2. AjoFactory — stateless registry; no owner.
        factory = new AjoFactory();

        vm.stopBroadcast();

        // ── Post-broadcast: file I/O and logging ─────────────────────────────

        _logDeployment(address(vault), address(factory), gdollarToken);
        _writeDeployments(address(vault), address(factory), gdollarToken, deployingMock);
        _logVerification(address(vault), address(factory), gdollarToken, deployingMock);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    function _logHeader(address deployer, address gdollar, bool mock) private view {
        console.log("=============================================");
        console.log("  Ajo Deployment  -  Celo Alfajores");
        console.log("=============================================");
        console.log("Deployer      :", deployer);
        console.log("Chain ID      :", block.chainid);
        if (mock) {
            console.log("G$ token      : (deploying MockGDollar)");
        } else {
            console.log("G$ token      :", gdollar);
        }
        console.log("Ubeswap router: address(0)  [hold mode]");
        console.log("---------------------------------------------");
    }

    function _logDeployment(address vault, address factory, address gdollar) private view {
        console.log("---------------------------------------------");
        console.log("AjoYieldVault :", vault);
        console.log("AjoFactory    :", factory);
        console.log("G$ token      :", gdollar);
        console.log("Vault owner   :", AjoYieldVault(vault).owner());
        console.log("Block         :", block.number);
        console.log("Timestamp     :", block.timestamp);
        console.log("=============================================");
    }

    /**
     * @notice Build a JSON deployment record and write it to
     *         deployments/alfajores.json, creating the directory if needed.
     *
     *         vm.serializeXxx accumulates key-value pairs under the object key
     *         "ajo". The final serialize call returns the completed JSON string,
     *         which vm.writeJson flushes to disk atomically.
     */
    function _writeDeployments(
        address vault,
        address factory,
        address gdollar,
        bool isMockToken
    ) private {
        vm.createDir(DEPLOYMENTS_DIR, /* recursive */ true);

        string memory obj = "ajo";
        vm.serializeString( obj, "network",      "alfajores");
        vm.serializeUint(   obj, "chainId",      44787);
        vm.serializeAddress(obj, "AjoYieldVault", vault);
        vm.serializeAddress(obj, "AjoFactory",    factory);
        vm.serializeAddress(obj, "gDollar",       gdollar);
        vm.serializeBool(   obj, "mockToken",     isMockToken);
        string memory json =
            vm.serializeString(obj, "deployedAt", vm.toString(block.timestamp));

        vm.writeJson(json, DEPLOYMENTS_FILE);
        console.log("Deployments written  :", DEPLOYMENTS_FILE);
    }

    /**
     * @notice Print manual forge verify-contract commands for each deployed
     *         contract. These match the [etherscan.celo_alfajores] entry in
     *         foundry.toml and can be copy-pasted if --verify fails due to a
     *         Celoscan indexing delay.
     *
     *         AjoYieldVault constructor args: (address _gDollarToken, address _ubeswapRouter)
     *         AjoFactory constructor args:    none
     *         MockGDollar constructor args:   none  (if deployed)
     */
    function _logVerification(
        address vault,
        address factory,
        address gdollar,
        bool mockDeployed
    ) private pure {
        string memory api = "https://api-alfajores.celoscan.io/api";
        string memory tail = string.concat(
            " --verifier-url ", api,
            " --etherscan-api-key $CELOSCAN_API_KEY",
            " --chain-id 44787"
        );

        console.log("");
        console.log("=== Manual Celoscan Verification ===");
        console.log("(forge script --verify handles this automatically)");
        console.log("Copy-paste only if auto-verify times out:\n");

        // ── MockGDollar (if deployed) ─────────────────────────────────────────
        if (mockDeployed) {
            console.log("# MockGDollar  (testnet only, no constructor args)");
            console.log(
                string.concat(
                    "forge verify-contract ", vm.toString(gdollar),
                    " script/Deploy.s.sol:MockGDollar",
                    tail
                )
            );
            console.log("");
        }

        // ── AjoYieldVault ─────────────────────────────────────────────────────
        console.log("# AjoYieldVault");
        console.log(
            string.concat(
                "forge verify-contract ", vm.toString(vault),
                " src/AjoYieldVault.sol:AjoYieldVault \\",
                "\n  --constructor-args $(cast abi-encode",
                " \"constructor(address,address)\" ",
                vm.toString(gdollar), " ",
                vm.toString(UBESWAP_ROUTER), ")",
                tail
            )
        );

        console.log("");

        // ── AjoFactory ────────────────────────────────────────────────────────
        console.log("# AjoFactory  (no constructor arguments)");
        console.log(
            string.concat(
                "forge verify-contract ", vm.toString(factory),
                " src/AjoFactory.sol:AjoFactory",
                tail
            )
        );

        console.log("\n=============================================");
    }
}
