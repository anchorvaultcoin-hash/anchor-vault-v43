
## 22. Upgradeable Vault Audit (Cubewire)
OpenZeppelin's audit of **Cubewire Vault** (Feb 2026, Solidity) covers an upgradeable ERC-4626 vault:
- **0 Critical**, **0 High**, **1 Medium**, **3 Low** issues identified
- 15 of 18 findings resolved
- Medium: infinite approvals bypass whitelist after de-whitelisting
- Coverage: UUPS upgrades, ERC-2771 meta-tx, oracle pricing, whitelist, role-based access

AnchorVault V45's immutable design, offline EIP-712 signatures, and absence of upgradeable proxies eliminate the privilege escalation and whitelist bypass vectors found here.
