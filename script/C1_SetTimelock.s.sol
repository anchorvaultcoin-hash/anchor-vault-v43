// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";
import {MockANCR} from "../test/mocks/MockANCR.sol";

contract C1_SetTimelock is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        uint256 mainKey = vm.envUint("MAIN_KEY");
        address user = 0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479;
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;

        vm.startBroadcast(pk);

        // 1) новый токен
        MockANCR token2 = new MockANCR(1000 ether);
        // 2) добавляем в supported
        AnchorVaultV45(payable(vaultAddr)).addSupportedToken(address(token2));
        // 3) аппрув
        token2.approve(vaultAddr, type(uint256).max);
        // 4) открываем FORTRESS (level=2)
        AnchorVaultV45.VaultParams memory p = AnchorVaultV45.VaultParams({
            name: "FortressVault",
            mainAuthKey: 0x8d22bBDA101751805CB2dfa9b55AB79c353fAa47,
            recoveryAuthKey: 0xC0291AF2D7F91BDB24cd9a870f125a155477B8D7,
            amount: 100 ether
        });
        AnchorVaultV45(payable(vaultAddr)).openVault(address(token2), p, 2);

        vm.stopBroadcast();

        // 5) подписываем setTimelock (nonce=0, deadline=+1h, hoursVal=48)
        uint64 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;
        bytes32 DOMAIN_SEPARATOR = AnchorVaultV45(payable(vaultAddr)).domainSeparator();
        bytes32 TYPEHASH = keccak256("SetTimelock(address owner,uint256 vaultId,uint256 hoursVal,uint64 nonce,uint256 deadline)");
        // vaultId будет 2 (первый SAFE id=1, теперь FORTRESS id=2)
        uint256 vid = 2;
        uint256 hoursVal = 48;
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, user, vid, hoursVal, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mainKey, digest);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.startBroadcast(pk);
        AnchorVaultV45(payable(vaultAddr)).setTimelock(vid, hoursVal, deadline, sig);
        vm.stopBroadcast();
    }
}
