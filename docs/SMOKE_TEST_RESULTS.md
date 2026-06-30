# Smoke Test Results

Ghi kết quả smoke test thủ công trước khi merge hoặc deploy. Checklist chi tiết nằm ở `docs/SMOKE_TEST_CHECKLIST.md`.

## 2026-06-30 Local Verification

- Date: 2026-06-30
- Branch: `maintenance/next-upgrades`
- Commit: `e5a9b52` plus uncommitted maintenance changes
- Environment: Windows local workspace
- Tester: Codex
- Node: `v24.14.0` (allowed by `>=22 <25`; CI uses Node 22)
- Java/JDK: `21.0.10`
- Browser: Not run

### Commands

| Check | Result | Notes |
|------|--------|-------|
| `npm ci` | Pass | 880 packages installed from lockfile |
| `npm test` | Pass | 7 files, 32 tests |
| `npm run test:rules` | Pass | 1 file, 8 Firestore Rules tests; emulator moved to port `8085` |
| `npm run build` | Pass | Vite 8 build succeeds; no >500 kB chunk warning |
| `npm run audit:security:gate` | Pass | 0 high, 0 critical |
| `npm run audit:security:full` | Reviewed | Exits non-zero because 9 known moderate tooling advisories remain |
| `npm outdated --json` | Pass | `{}` |
| `npm run ci` | Pass | Passed after clearing a stale local Firestore emulator Java process from an earlier failed run |

### Manual Flows

| Flow | Result | Notes |
|------|--------|-------|
| Admin login | Not run | Needs browser smoke test with real/staging credentials |
| Dashboard refresh | Not run | Needs browser smoke test |
| Settings health + backup JSON | Not run | Needs browser smoke test |
| Student portal + lesson Markdown/lightbox | Not run | Needs browser smoke test |
| Feedback submit + reload | Not run | Needs browser smoke test |
| Practice quiz submit/reload | Not run | Needs browser smoke test |
| Exam quiz submit/reload | Not run | Needs browser smoke test |
| Project report flow | Not run | Needs browser smoke test |
| Showdown admin + student tabs | Not run | Needs browser smoke test |
| Spy admin + student tabs | Not run | Needs browser smoke test |

### Issues

- NVIDIA Broadcast uses local port `8080`, so Firestore Emulator is configured on `8085`.
- On this Windows machine, a failed Rules test can leave a Java Firestore Emulator process holding `8085`; stop the stale `java` process only when the next local run reports the port is taken.
- Manual browser smoke is still required before production deploy.

## 2026-06-29 Local Verification

- Date: 2026-06-29
- Branch: `maintenance/next-upgrades`
- Commit: `e5a9b52`
- Environment: Windows local workspace
- Tester: Codex
- Node: `v24.14.0` (allowed by `>=22 <25`; CI uses Node 22)
- Browser: Not run

### Commands

| Check | Result | Notes |
|------|--------|-------|
| `npm ci` | Pass | Initial retry required after stopping stale Vite/node processes that locked `lightningcss` |
| `npm test` | Pass | 7 files, 32 tests |
| `npm run test:rules` | Blocked local | Fails before tests with `spawn java ENOENT`; verify in CI with Temurin 21 or install JDK 21 locally |
| `npm run build` | Pass | Vite 8 build succeeds; no >500 kB chunk warning |
| `npm run audit:security:gate` | Pass | 0 high, 0 critical |
| `npm run audit:security:full` | Reviewed | 9 moderate tooling advisories remain, documented in `docs/SECURITY_AUDIT_NOTES.md` |

### Manual Flows

| Flow | Result | Notes |
|------|--------|-------|
| Admin login | Not run | Needs browser smoke test |
| Dashboard refresh | Not run | Needs browser smoke test |
| Settings health + backup JSON | Not run | Needs browser smoke test |
| Student portal + lesson Markdown/lightbox | Not run | Needs browser smoke test |
| Feedback submit + reload | Not run | Needs browser smoke test |
| Practice quiz submit/reload | Not run | Needs browser smoke test |
| Exam quiz submit/reload | Not run | Needs browser smoke test |
| Project report flow | Not run | Needs browser smoke test |
| Showdown admin + student tabs | Not run | Needs browser smoke test |
| Spy admin + student tabs | Not run | Needs browser smoke test |

### Issues

- Local Firestore Rules tests require Java/JDK 21. GitHub Actions is configured to install Temurin 21 before `npm run ci`.

## Template

- Date:
- Branch:
- Commit:
- Environment:
- Tester:
- Node:
- Browser:

### Commands

| Check | Result | Notes |
|------|--------|-------|
| `npm ci` | Not run | |
| `npm test` | Not run | |
| `npm run test:rules` | Not run | Requires Java/JDK 21 or CI |
| `npm run build` | Not run | |
| `npm run audit:security:gate` | Not run | |
| `npm run audit:security:full` | Not run | Known moderate tooling items may remain |

### Manual Flows

| Flow | Result | Notes |
|------|--------|-------|
| Admin login | Not run | |
| Dashboard refresh | Not run | |
| Settings health + backup JSON | Not run | |
| Student portal + lesson Markdown/lightbox | Not run | |
| Feedback submit + reload | Not run | |
| Practice quiz submit/reload | Not run | |
| Exam quiz submit/reload | Not run | |
| Project report flow | Not run | |
| Showdown admin + student tabs | Not run | |
| Spy admin + student tabs | Not run | |

### Issues

- None recorded.
