// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";
import {MockANCR} from "../test/mocks/MockANCR.sol";

contract F_PauseTests is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        uint256 mainKey = vm.envUint("MAIN_KEY");
        address user = 0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479;
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;
        address newGuardian = 0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47;

        // 1. Передаём роль guardian временному адресу
        vm.startBroadcast(pk);
        AnchorVaultV45(payable(vaultAddr)).transferGuardianship(newGuardian);
        vm.stopBroadcast();

        vm.startBroadcast(mainKey);
        AnchorVaultV45(payable(vaultAddr)).acceptGuardianship();
        vm.stopBroadcast();

        // 2. F3: emergencyPause от нового guardian
        vm.startBroadcast(mainKey);
        AnchorVaultV45(payable(vaultAddr)).emergencyPause();
        vm.stopBroadcast();

        // 3. F4: withdrawFromVault на паузе (должен работать)
        vm.startBroadcast(pk);
        MockANCR t = new MockANCR(100 ether);
        AnchorVaultV45(payable(vaultAddr)).addSupportedToken(address(t));
        t.approve(vaultAddr, type(uint256).max);
        AnchorVaultV45.VaultParams memory p = AnchorVaultV45.VaultParams({
            name: "PauseWithdraw",
            mainAuthKey: newGuardian,
            recoveryAuthKey: 0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7,
            amount: 50 ether
        });
        uint256 vid = AnchorVaultV45(payable(vaultAddr)).openVault(address(t), p, 0);
        vm.stopBroadcast();

        uint64 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 DOMAIN_SEPARATOR = AnchorVaultV45(payable(vaultAddr)).domainSeparator();
        bytes32 TYPEHASH = keccak256("Withdraw(address owner,uint256 vaultId,uint256 amount,address to,uint64 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, user, vid, uint256(10 ether), user, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mainKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.startBroadcast(pk);
        AnchorVaultV45(payable(vaultAddr)).withdrawFromVault(vid, 10 ether, user, deadline, sig);
        vm.stopBroadcast();

        // 4. F6: unpause от creator
        vm.startBroadcast(pk);
        AnchorVaultV45(payable(vaultAddr)).unpause();
        vm.stopBroadcast();
    }
}
