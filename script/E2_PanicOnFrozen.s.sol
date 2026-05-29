// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {AnchorVaultV45} from "../src/AnchorVaultV45.sol";

contract E2_PanicOnFrozen is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address vaultAddr = 0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17;
        uint256 vid = 5; // замороженный сейф
        vm.startBroadcast(pk);
        AnchorVaultV45(payable(vaultAddr)).panicWithdraw(vid);
        vm.stopBroadcast();
    }
}
