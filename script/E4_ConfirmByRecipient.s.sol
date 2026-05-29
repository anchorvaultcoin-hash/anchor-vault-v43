// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";

contract E4_ConfirmByRecipient is Script {
    function run() external {
        uint256 recKey = vm.envUint("RECOVERY_KEY"); // приватный ключ получателя
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;
        uint256 transferId = 2;

        vm.startBroadcast(recKey);
        AnchorVaultV45(payable(vaultAddr)).confirmSecureTransfer(transferId);
        vm.stopBroadcast();
    }
}
