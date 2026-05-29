// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console2} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";

/**
 * @notice Деплой ТОЛЬКО AnchorVaultV45. Использует уже задеплоенный MockANCR.
 */
contract Deploy is Script {
    // MockANCR из первого (частично-успешного) деплоя
    address constant ANCR_TOKEN = 0x490Dd216A9aaD4fA389deca73a7cA4Ca01B24BDD;

    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address guardian = vm.envAddress("GUARDIAN_ADDRESS");
        address deployer = vm.addr(pk);

        require(guardian != deployer, "guardian must differ from deployer");

        vm.startBroadcast(pk);

        console2.log("MockANCR (existing):", ANCR_TOKEN);

        AnchorVaultV45 vault = new AnchorVaultV45(ANCR_TOKEN, guardian);
        console2.log("AnchorVaultV45:    ", address(vault));
        console2.log("  creator:         ", deployer);
        console2.log("  guardian:        ", guardian);
        console2.log("  VERSION:         ", vault.VERSION());

        vm.stopBroadcast();

        console2.log(unicode"\n=== ДЕПЛОЙ V45 ЗАВЕРШЁН ===");
    }
}
