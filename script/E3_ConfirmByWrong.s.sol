// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";

contract E3_ConfirmByWrong is Script {
    function run() external {
        uint256 wrongKey = vm.envUint("MAIN_KEY");  // не получатель
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;
        uint256 transferId = 1;  // первый эскроу (предположительно)

        vm.startBroadcast(wrongKey);
        AnchorVaultV45(payable(vaultAddr)).confirmSecureTransfer(transferId);
        vm.stopBroadcast();
    }
}
