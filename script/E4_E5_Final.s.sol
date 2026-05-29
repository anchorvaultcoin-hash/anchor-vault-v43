// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";
import {MockANCR} from "../test/mocks/MockANCR.sol";

contract E4_E5_Final is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        uint256 recKey = vm.envUint("RECOVERY_KEY");
        uint256 mainKey = vm.envUint("MAIN_KEY");
        address user = 0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479;
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;
        address recipient = 0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7;
        address emergencyAddr = 0x2bd8946f52C6255710fC61a44f16875f8A56B4aC;
        address newMain = 0x5555555555555555555555555555555555555555;
        address newRecovery = 0x6666666666666666666666666666666666666666;

        // 1. Пополняем получателя и устанавливаем emergency
        vm.startBroadcast(pk);
        payable(recipient).transfer(0.01 ether);
        vm.stopBroadcast();

        vm.startBroadcast(recKey);
        // если emergency ещё не установлен — установится; если уже был — эта транзакция ревертнет,
        // но это не страшно, мы просто пропустим через try/catch? У нас нет try/catch в скрипте.
        // Поэтому просто вызовем, если revert — ничего страшного, т.к. emergency уже есть.
        // Но чтобы избежать остановки, обернём в if.
        if (AnchorVaultV45(payable(vaultAddr)).globalEmergency(recipient) == address(0)) {
            AnchorVaultV45(payable(vaultAddr)).setGlobalEmergency(emergencyAddr);
        }
        vm.stopBroadcast();

        // 2. Создаём токен, сейф, инициируем эскроу
        vm.startBroadcast(pk);
        MockANCR t = new MockANCR(50 ether);
        AnchorVaultV45(payable(vaultAddr)).addSupportedToken(address(t));
        t.approve(vaultAddr, type(uint256).max);
        AnchorVaultV45.VaultParams memory p = AnchorVaultV45.VaultParams({
            name: "E4Test",
            mainAuthKey: 0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47,
            recoveryAuthKey: recipient,
            amount: 20 ether
        });
        uint256 vid = AnchorVaultV45(payable(vaultAddr)).openVault(address(t), p, 0);
        uint64 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 DOMAIN_SEPARATOR = AnchorVaultV45(payable(vaultAddr)).domainSeparator();
        bytes32 TYPEHASH = keccak256("InitSecureTransfer(address owner,uint256 vaultId,address to,address newMainKey,address newRecoveryKey,uint64 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, user, vid, recipient, newMain, newRecovery, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mainKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);
        uint256 transferId = AnchorVaultV45(payable(vaultAddr)).initSecureTransfer(vid, recipient, newMain, newRecovery, deadline, sig);
        vm.stopBroadcast();

        // E4: Подтверждение получателем
        vm.startBroadcast(recKey);
        AnchorVaultV45(payable(vaultAddr)).confirmSecureTransfer(transferId);
        vm.stopBroadcast();

        // E5: Повторное подтверждение — должно ревертнуть TransferNotPending
        vm.startBroadcast(recKey);
        AnchorVaultV45(payable(vaultAddr)).confirmSecureTransfer(transferId);
        vm.stopBroadcast();
    }
}
