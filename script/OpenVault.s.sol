// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";

contract OpenVaultScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);

        AnchorVaultV45.VaultParams memory p = AnchorVaultV45.VaultParams({
            name: "Test Vault",
            mainAuthKey: 0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47,
            recoveryAuthKey: 0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7,
            amount: 100 ether
        });

        AnchorVaultV45(payable(0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17))
            .openVault(0x490Dd216A9aaD4fA389deca73a7cA4Ca01B24BDD, p, 0);

        vm.stopBroadcast();
    }
}
