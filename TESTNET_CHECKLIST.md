# Чек-лист прогона в Sepolia

После деплоя пройди сценарии вручную (Etherscan «Write Contract» или скриптом).
Для операций с подписью нужен фронт/скрипт, формирующий EIP-712 подпись
`mainAuthKey`/`recoveryAuthKey` (см. test/AnchorVaultV45.t.sol — функция `_sign`).

Отмечай результат: ✅ ок / ❌ реверт (с причиной). Логи присылай мне.

## A. Базовый цикл
- [ ] A1. `setGlobalEmergency(addr)` — задать аварийный адрес.
- [ ] A2. Повторный `setGlobalEmergency` — должен ревертить (GlobalEmergencyChangePending).
- [ ] A3. `approve` токена на Vault.
- [ ] A4. `openVault(token, params, level)` — открыть сейф. Проверить amount = депозит − 0.2%.
- [ ] A5. Второй `openVault` тем же токеном — реверт (VaultLimitReached).
- [ ] A6. `depositToVault` — пополнить. Проверить начисление − fee уровня.

## B. Вывод по подписи (EIP-712)
- [ ] B1. `withdrawFromVault` с валидной подписью mainAuthKey — ✅, net = amount − 0.5%.
- [ ] B2. Та же подпись повторно — реверт (BadSignature, nonce сдвинут).
- [ ] B3. Подпись recoveryAuthKey на withdraw — реверт (BadSignature).
- [ ] B4. Подпись с истёкшим deadline — реверт (SignatureExpired).
- [ ] B5. Вывод amount=0 / больше баланса / на адрес контракта — реверт.

## C. Таймлок
- [ ] C1. `setTimelock(vid, 48ч, ...)` на FORTRESS-сейфе.
- [ ] C2. `withdrawFromVault` до истечения — реверт (VaultTimelocked).
- [ ] C3. После warp/ожидания — вывод проходит.

## D. Экстренные (recoveryAuthKey)
- [ ] D1. `earlyClose` подписью recovery — ✅, payout = amount − 5%.
- [ ] D2. `earlyClose` подписью main — реверт (BadSignature).
- [ ] D3. `recoverToSafe` — payout на emergency, − 10%.
- [ ] D4. `emergencyWithdrawToAny(to)` — на произвольный адрес, − 15%.
- [ ] D5. `panicWithdraw` БЕЗ подписи — на globalEmergency, − 20%.

## E. Secure-transfer (эскроу)
- [ ] E1. `initSecureTransfer` к чистому получателю — сейф FROZEN.
- [ ] E2. `panicWithdraw` на FROZEN — реверт (NotActive).
- [ ] E3. `confirmSecureTransfer` чужим адресом — реверт.
- [ ] E4. `confirmSecureTransfer` получателем — ✅, сейф у получателя.
- [ ] E5. Повторный confirm — реверт.
- [ ] E6. `reclaimExpiredTransfer(несущ. id)` — реверт (TransferNotFound).

## F. Роли / пауза
- [ ] F1. Юзер вызывает `addSupportedToken` — реверт (NotCreator).
- [ ] F2. Юзер вызывает `emergencyPause` — реверт (NotGuardian).
- [ ] F3. guardian `emergencyPause` — ✅.
- [ ] F4. На паузе `withdrawFromVault` — ✅ работает (0.5%).
- [ ] F5. На паузе `openVault` — реверт (ContractPaused).
- [ ] F6. guardian `unpause` — реверт; creator `unpause` — ✅.

## G. globalEmergency смена
- [ ] G1. `proposeGlobalEmergencyChange(new)` — ✅.
- [ ] G2. `confirmGlobalEmergencyChange` до 7 дней — реверт.
- [ ] G3. После 7 дней — ✅, адрес сменился.
- [ ] G4. `cancelGlobalEmergencyChange` — отменяет pending.

## Что прислать мне
- Адреса задеплоенных контрактов.
- Таблицу A–G с ✅/❌ и причинами revert.
- Любое неожиданное поведение (где ожидал одно, получил другое).
