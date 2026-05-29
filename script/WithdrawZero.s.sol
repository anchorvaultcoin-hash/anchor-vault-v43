// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";

contract WithdrawZeroScript is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        uint256 mainKey = vm.envUint("MAIN_KEY");
        address user = 0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479;
        uint256 vid = 1;
        uint256 amount = 0;             // невалидно
        address to = user;
        uint64 nonce = 1;               // текущий nonce
        uint256 deadline = block.timestamp + 1 hours;

        bytes32 DOMAIN_SEPARATOR = AnchorVaultV45(payable(0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17)).domainSeparator();
        bytes32 TYPEHASH = keccak256("Withdraw(address owner,uint256 vaultId,uint256 amount,address to,uint64 nonce,uint256 deadline)");
        bytes32 structHash = keccak256(abi.encode(TYPEHASH, user, vid, amount, to, nonce, deadline));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(mainKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.startBroadcast(pk);
        AnchorVaultV45(payable(0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17))
            .withdrawFromVault(vid, amount, to, deadline, signature);
        vm.stopBroadcast();
    }
}
