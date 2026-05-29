# Known Issues & Design Decisions — AnchorVaultV45

This document lists internally identified findings, design decisions, and
accepted trade-offs. **Auditors: please verify our reasoning and challenge
anything that looks wrong.** Where the project has chosen to accept a finding,
the rationale is given explicitly.

Severity scale follows the standard Code4rena / Cantina taxonomy
(Critical / High / Medium / Low / Informational).

---

## I-1. `emergencyAddress` snapshot vs. live `globalEmergency`

**Severity:** Informational (design clarification).
**Status:** Documented intentional behavior.

### Description
`recoverToSafe(vid, sig)` transfers funds to `v.emergencyAddress` — a
*snapshot* taken at vault creation time (`openVault`). Meanwhile,
`panicWithdraw(vid)` transfers funds to `globalEmergency[msg.sender]` —
the *live* value, which may have been rotated through the 7-day timelock
since the vault was opened.

After a successful `confirmGlobalEmergencyChange`, these two destinations
diverge:
- `recoverToSafe` → still goes to the original address.
- `panicWithdraw` → goes to the new address.

### Rationale
This is intentional. `panicWithdraw` is the "I lost my keys and possibly
have a thief" lever; it must always route to the *currently approved*
cold wallet. `recoverToSafe` is a softer rotation tool, used in normal
operation where the user still controls the vault; it preserves a stable
target that cannot be changed without timelock + key signature.

### Mitigation / note for auditors
Both functions are documented in NatSpec. UI surfaces both destinations
explicitly so users can see where funds will go before signing.
Recommendation accepted from auditor: if you believe both should route
to the same address, please flag for discussion.

---

## I-2. Single `nonce` for both main and recovery signatures

**Severity:** Low (UX impact, no security loss).
**Status:** Accepted trade-off.

### Description
Each vault has a single `nonce` counter that increments on **any**
successful EIP-712 operation (main-key or recovery-key). A pre-signed
recovery message held offline ("break-glass" pattern) is invalidated as
soon as the main key signs *any* operation.

### Rationale
A single nonce is simpler and prevents subtle replay vectors that
separate counters would open. The break-glass UX is achievable in
practice by re-signing recovery messages periodically (e.g., monthly)
or by signing them just-in-time when needed.

### Mitigation / note for auditors
This is a deliberate design trade-off. If you believe split nonces are
worth the added complexity, please quantify the UX gain and propose a
schema that prevents cross-channel replay.

---

## I-3. Griefing of incoming `secureTransfer` slot

**Severity:** Low (already flagged by DeepSeek).
**Status:** Mitigation considered for V45.1.

### Description
`initSecureTransfer(vid, to, …)` claims
`pendingIncomingTransfer[to][token]`. While that slot is non-zero, the
recipient cannot receive *any* incoming secure transfer for that token.
Only the original sender (via `cancelSecureTransfer`) or any third party
after expiry (`reclaimExpiredTransfer`) can release it.

A malicious actor can therefore lock a victim's incoming-transfer slot
for that token for up to 48 hours per attack, simply by initiating
spurious transfers.

### Rationale for accepting on testnet
- The attacker pays the cost (their own vault is frozen for the same
  48-hour window).
- The recipient can still receive transfers of *other* supported tokens.
- The recipient can still receive funds via direct ERC-20 transfer
  (outside the vault system) or via a non-secure `transferVault`.

### Mitigation considered (post-audit)
Allow the recipient to *decline* (clear) an unwanted incoming transfer
without revealing the confirm code — turning the slot from "first writer
wins for 48h" into "recipient can release at any time".

### Note for auditors
Please confirm this severity is appropriate and that no escalation
vector (e.g., combined with another operation) raises this above Low.

---

## I-4. `forge-lint` `unsafe-typecast` warnings

**Severity:** Informational.
**Status:** False positives — preceding checks make casts safe.

### Description
`forge-lint` flags several `uint120(...)` and `uint48(...)` casts as
potentially truncating. Examples:

- `src/AnchorVaultV45.sol:872` — `uint48(lockUntilTimestamp)` is checked
  against `type(uint48).max` two lines above (`if (lockUntilTimestamp >
  type(uint48).max) revert LockTooLong();`).
- `_checkUint120()` is called before every `uint120(amount)` cast.

### Rationale
The linter does not perform inter-procedural reasoning and is unable to
verify that the cast is guarded. The casts are correct as written.

### Mitigation / note for auditors
We chose **not** to add `// forge-lint: disable-next-line` annotations,
to keep the source clean. Auditors are invited to verify the cast safety
inline.

---

## I-5. Compiler / build flags

**Severity:** Informational.
**Status:** Resolved.

### Description
Earlier internal notes in the source (a stale comment on
`AnchorVaultV45.sol:645`) claimed the contract "compiles without
--via-ir". The actual `foundry.toml` uses `via_ir = true`.

### Resolution
`foundry.toml` is the single source of truth:

```toml
solc_version = "0.8.26"
via_ir = true
optimizer = true
optimizer_runs = 200
evm_version = "cancun"
```

The stale code comment will be cleaned up before the audit commit.
Etherscan verification on Sepolia uses these exact flags; auditors and
reviewers can reproduce the bytecode byte-for-byte with the same toolchain.

---

## I-6. Sepolia deployment artifacts (orphan MockANCR)

**Severity:** Informational (testnet hygiene, not in scope of mainnet audit).
**Status:** Documented.

### Description
The Sepolia deployment process produced two unused MockANCR instances
before the final successful Vault deploy:

- `0x490Dd216A9aaD4fA389deca73a7cA4Ca01B24BDD` (referenced as ANCR by
  the live Vault — **this is the operational one**)
- `0x22cb933Bb743926c580D87Db8FAD1E78719a294f` (orphan, unused)

The orphan exists due to `forge script` retry behavior under a strict
balance pre-check. It is not referenced by the Vault and holds no value.

### Mitigation
Documented here for completeness. Not relevant to mainnet — MockANCR
will not be used; the real ANCR token will be deployed once and
referenced immutably by the production Vault.

---

## Auditor checklist (suggested focus)

Beyond the items above, we particularly invite review of:

1. **EIP-712 domain separator** — chainId, address(this), versionString,
   no replay across vaults or chains.
2. **`secureTransfer` state machine** — six states transitions
   (PENDING → CONFIRMED / CANCELLED / EXPIRED), `pendingIncomingTransfer`
   slot accounting, race between `confirm` and `cancel`.
3. **Fee accounting** — `_accrueFees` split across token types
   (ANCR-style vs. non-ANCR), `lockedPrincipal` invariant under deposit /
   withdraw / penalty paths.
4. **Role transitions** — creator cooldown (7d), guardian cooldown (2d),
   creator cannot delegate to guardian, no path to bypass pause delay.
5. **Pause semantics** — withdraw works on pause; emergency penalties
   route 100% to `rewardPool` on pause; pause cannot strand user funds.
6. **`block.timestamp` usage** — used for deadlines, timelocks, cooldowns.
   We acknowledge miner influence (~±15s) is acceptable for all
   timeframes here (minimum 1h soft-lock; majority 7d+).
7. **Token compatibility** — accepts only `decimals() == 18`,
   non-rebase ERC-20. Fee-on-transfer tokens handled via balance-delta
   (`_safeReceive`); confirm correctness under hostile token behavior.

---

_All known issues above are open to challenge. Severity classifications
are our best estimates and may be revised based on auditor input._
