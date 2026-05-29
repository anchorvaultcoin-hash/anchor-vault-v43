# Security

## Disclosure
Found a vulnerability? Please report it to [your-email@example.com](mailto:your-email@example.com).
Do not open a public issue until the fix is released.

## Continuous Monitoring
- Every push to `main` runs **Foundry tests + Slither** via GitHub Actions.
- Pre-commit hook: run `./security-check.sh` before every commit.
- Auth keys should be rotated quarterly and stored on air-gapped machines.

## Audit History
| Date       | Type          | Findings | Status |
|------------|---------------|----------|--------|
| 2026-05-29 | AI-assisted (Claude Opus 4.8, DeepSeek) | All criticals resolved | ✅ Done |
| (Planned)  | External Audit (Code4rena / Cantina) | TBD | ⬜ Pending |

## Contacts
- Security: [your-email@example.com]
- Admin (creator): `0x6226828cc3d1B9c5fc1c4d9BE3dF7b03A4A70479`
