// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";
import {MockANCR} from "../test/mocks/MockANCR.sol";

contract D5_Panic is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address user = 0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479;
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;

        vm.startBroadcast(pk);
        MockANCR t = new MockANCR(300 ether);
        AnchorVaultV45(payable(vaultAddr)).addSupportedToken(address(t));
        t.approve(vaultAddr, type(uint256).max);
        AnchorVaultV45.VaultParams memory p = AnchorVaultV45.VaultParams({
            name: "PanicVault",
            mainAuthKey: 0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47,
            recoveryAuthKey: 0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7,
            amount: 50 ether
        });
        uint256 vid = AnchorVaultV45(payable(vaultAddr)).openVault(address(t), p, 0);
        AnchorVaultV45(payable(vaultAddr)).panicWithdraw(vid);
        vm.stopBroadcast();
    }
}
