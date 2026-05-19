// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../contracts/AnchorVaultV43.sol";

contract AnchorVaultV43Echidna is AnchorVaultV43 {
    constructor() AnchorVaultV43(address(0x1234), address(0x5678)) {
        // Заглушка — Echidna будет вызывать функции напрямую
    }

    // Инвариант 1: VERSION всегда 43
    function echidna_version_always_43() public view returns (bool) {
        return VERSION == 43;
    }

    // Инвариант 2: MIN_DEPOSIT > 0
    function echidna_min_deposit_positive() public view returns (bool) {
        return MIN_DEPOSIT == 10**16;
    }

    // Инвариант 3: ANCR_TOKEN не нулевой
    function echidna_ancr_not_zero() public view returns (bool) {
        return ANCR_TOKEN != address(0);
    }
}
