# AnchorVault V45 — Project Status

**Дата:** 2026-05-29  
**Состояние:** Pre-Audit Ready

## Текущий статус
- Solidity 0.8.26, via_ir=true, компиляция без ошибок.
- Foundry: **18/18 тестов пройдено** (unit + EIP-712 + invariant + reentrancy + panic + timelock + emergency).
- Slither: 0 реальных уязвимостей.
- Sepolia: A–G сценарии пройдены 100%.
- Репозиторий вычищен от старых версий.

## Адреса Sepolia
- AnchorVaultV45: `0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17`
- MockANCR: `0x490Dd216A9aaD4fA389deca73a7cA4Ca01B24BDD`
- Creator: `0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479`
- Guardian: `0xe0DACa428Abc3F1D5BD333C2D1Ca12dd1a36964D`

## Следующие шаги
1. Внешний аудит (Code4rena / Cantina / приватный).
2. После успешного аудита — деплой в mainnet с капом на TVL.
