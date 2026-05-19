// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockFOT
 * @notice Тест-токен с fee-on-transfer 1% для проверки _safeReceive защиты.
 */
contract MockFOT is ERC20 {
    uint256 public constant TRANSFER_FEE_BPS = 100; // 1%

    constructor(uint256 initialSupply) ERC20("Mock FOT", "FOT") {
        _mint(msg.sender, initialSupply);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * TRANSFER_FEE_BPS) / 10000;
        uint256 net = value - fee;
        super._update(from, address(0xdead), fee);
        super._update(from, to, net);
    }
}
