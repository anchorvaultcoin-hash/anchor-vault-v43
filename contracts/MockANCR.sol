// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockANCR
 * @notice Тест-токен для локальных тестов V43. Поддерживает burn(amount) (IBurnable).
 *         Не используется в Sepolia/Mainnet.
 */
contract MockANCR is ERC20 {
    constructor(uint256 initialSupply) ERC20("Mock Anchor", "mANCR") {
        _mint(msg.sender, initialSupply);
    }

    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
