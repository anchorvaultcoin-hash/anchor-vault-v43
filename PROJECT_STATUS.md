# AnchorVault — ТОЧКА СОХРАНЕНИЯ (для нового чата)

Кидай этот файл + папку `foundry/` первым сообщением в новый чат — Claude
подхватит за минуту. Подробный handoff для свежего AI-помощника лежит
рядом в `HANDOFF_CONTEXT.md`.

## Где мы

Проект прошёл V0.1 → V44 (дырявая) → V45 (переработана). Сейчас:
**V45 готова к внешнему аудиту.** Sepolia-тестнет полностью пройден
(чек-лист A–G — 100%). Над проектом параллельно работали Claude и DeepSeek;
памяти между чатами у ИИ нет — преемственность держит пользователь и
эти файлы.

## V45 — что сделано

- EIP-712 авторизация, ДВА раздельных ключа на сейф: mainAuthKey (обычные
  операции), recoveryAuthKey (экстренные). Ключи ≠ EOA владельца → честная
  двухфакторность.
- Replay-защита: per-vault `nonce` + `deadline` + доменный сепаратор
  (chainId, адрес контракта) + vaultId.
- globalEmergency: первичная установка мгновенно; смена — 7-дн таймлок
  + отмена.
- timelockHours реально блокирует withdraw (отсчёт от depositedAt).
- Пауза не штрафует: withdraw 0.5% работает на паузе; штрафы экстренных
  на паузе → 100% rewardPool.
- transferCreatorship не может выдать роль guardian.
- deposit fee через `_accrueFees`; reclaim проверяет существование
  `transferId`; `secureTransfers` private.
- Удалены: текстовые коды, антифишинг-секрет, вся brute-force-машинерия.
- Раздача токенов вынесена в отдельный AnchorDistributor.

## Проверки (статус)

- **Компиляция:** solc 0.8.26, via_ir, 0 ошибок, 22 005 байт. Lint-предупреждения
  forge-lint (`unsafe-typecast`) — задокументированные false positive (каст
  всегда защищён предшествующим `_check…`).
- **Foundry-тесты:** 12 / 12 passed (включая `invariant_Solvency`, EIP-712,
  replay-protection, key separation, timelock, role boundaries).
- **Slither 0.11.5:** 0 реальных уязвимостей. Всё — OZ-библиотека, by-design
  (timestamp), ложное (locked-ether), косметика.
- **DeepSeek-аудит V45:** 2 Low (грифинг эскроу; теор. overflow nonce uint64
  — недостижим). High/Critical нет.
- **Внутренний аудит Claude:** 4 known design decisions, задокументированы
  в `KNOWN_ISSUES.md`.

## Sepolia testnet — БОЕВОЙ ДЕПЛОЙ

```
AnchorVaultV45:  0xfDa8F11d80D17bbBBFBBF778D4fDa9f275B48f17
MockANCR:        0x490Dd216A9aaD4fA389deca73a7cA4Ca01B24BDD
Creator:         0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479
Guardian:        0xe0DACa428Abc3F1D5BD333C2D1Ca12dd1a36964D
Emergency:       0x2bd8946f52C6255710fC61a44f16875f8A56B4aC
Main auth:       0x8d22bBDA... (полный ключ хранится у владельца)
Recovery auth:   0xC0291AF2... (полный ключ хранится у владельца)
Chain ID:        11155111 (Sepolia)
```

**Чек-лист A–G: 100% passed.** Все семь разделов прошли с ожидаемым
поведением:

- A. Vault creation + globalEmergency setup
- B. Withdraw по подписи mainAuthKey (replay/deadline/wrong-key защиты)
- C. Timelock enforcement
- D. Recovery flow (earlyClose / recoverToSafe / emergencyWithdrawToAny /
  panicWithdraw)
- E. Secure transfer (эскроу 48ч с подтверждением)
- F. Role boundaries + pause flow
- G. globalEmergency смена с 7-дн таймлоком

Транзакционные хеши и broadcast-логи сохранены в
`broadcast/Deploy.s.sol/11155111/run-latest.json`.

## Что ДАЛЬШЕ по порядку

1. **Внешний аудит:** Code4rena / Cantina контест ИЛИ Immunefi баг-баунти
   ИЛИ приватный аудитор. Скоуп и формат — см. `AUDIT_SCOPE.md` (создать
   перед отправкой; шаблон в `KNOWN_ISSUES.md`).
2. **Фиксы по выводам аудита**, повторный прогон тестов и тестнета.
3. **Mainnet — только потом**, и с КАПОМ на TVL и депозит.
4. Постепенное снятие капа по операционным метрикам.

## ЖЕЛЕЗНЫЕ ПРАВИЛА

- Ни Claude, ни DeepSeek НЕ дают допуск в mainnet. Только инструмент
  подготовки.
- «Тесты зелёные» ≠ «дыр нет». Доказывает только проверенное.
- Любая правка кода → перепрогон всех тестов.
- Новый чат начинать с загрузки этих файлов + `HANDOFF_CONTEXT.md`.
- ИИ не могут задеплоить сами (нет ключа/сети) — деплоит пользователь
  по скрипту.

---

_Последнее обновление: 30 мая 2026 г. Sepolia A–G passed 100%._
