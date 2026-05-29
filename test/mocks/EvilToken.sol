// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IBurnable} from "../../src/AnchorVaultV45.sol";

contract EvilToken is ERC20, IBurnable {
    bool public reenter;
    address public vault;

    constructor(uint256 initialSupply) ERC20("Evil", "EVL") {
        _mint(msg.sender, initialSupply);
    }

    function setReenterTarget(address _vault, bool _reenter) external {
        vault = _vault;
        reenter = _reenter;
    }

    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (reenter && vault != address(0)) {
            (bool success, ) = vault.call(abi.encodeWithSignature("withdrawFromVault(uint256,uint256,address,uint256,bytes)", 1, amount, address(this), block.timestamp + 3600, ""));
        }
        return super.transfer(to, amount);
    }
}
