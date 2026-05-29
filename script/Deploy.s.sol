// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";
import {MockANCR} from "../test/mocks/MockANCR.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address deployer = vm.addr(pk);

        require(guardian != deployer, "guardian must differ from deployer");

        vm.startBroadcast(pk);

        MockANCR ancr = new MockANCR(10_000_000 ether);
        console2.log("MockANCR:        ", address(ancr));

        AnchorVaultV45 vault = new AnchorVaultV45(address(ancr), guardian);
        console2.log("AnchorVaultV45:  ", address(vault));
        console2.log("  creator:       ", deployer);
        console2.log("  guardian:      ", guardian);
        console2.log("  VERSION:       ", vault.VERSION());

        vm.stopBroadcast();

        console2.log("=== DEPLOY TO SEPOLIA COMPLETED ===");
        console2.log("Next: follow TESTNET_CHECKLIST.md");
    }
}
