// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";
import {MockANCR} from "../test/mocks/MockANCR.sol";

contract E1_InitSecureTransfer is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        uint256 mainKey = vm.envUint("MAIN_KEY");
        address user = 0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479;
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;
        address to = 0xe0DACa428Abc3F1D5BD333C2D1Ca12dd1a36964D;

        vm.startBroadcast(pk);
        MockANCR t = new MockANCR(200 ether);
        AnchorVaultV45(payable(vaultAddr)).addSupportedToken(address(t));
        t.approve(vaultAddr, type(uint256).max);
        AnchorVaultV45.VaultParams memory p = AnchorVaultV45.VaultParams({
            name: "EscrowVault",
            mainAuthKey: 0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47,
            recoveryAuthKey: 0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7,
            amount: 50 ether
        });
        uint256 vid = AnchorVaultV45(payable(vaultAddr)).openVault(address(t), p, 0);
        vm.stopBroadcast();

        // initSecureTransfer: nonce=0, новые ключи получателя
        uint64 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 DOMAIN_SEPARATOR = AnchorVaultV45(payable(vaultAddr)).domainSeparator();
        bytes32 TYPEHASH = keccak256("InitSecureTransfer(address owner,uint256 vaultId,address to,address newMainKey,address newRecoveryKey,uint64 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, user, vid, to,
            0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47,
            0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7,
            nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mainKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.startBroadcast(pk);
        AnchorVaultV45(payable(vaultAddr)).initSecureTransfer(vid, to,
            0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47,
            0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7,
            deadline, sig);
        vm.stopBroadcast();
    }
}
