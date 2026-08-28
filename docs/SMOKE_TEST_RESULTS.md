# Smoke Test Results

Ghi kết quả smoke test thủ công trước khi merge hoặc deploy. Checklist chi tiết nằm ở `docs/SMOKE_TEST_CHECKLIST.md`.

## 2026-08-28 Pre-push verification

- Date: 2026-08-28
- Branch: `main` (uncommitted release prep)
- Environment: Windows local workspace
- Tester: Cursor Agent
- Browser: Not run (cần smoke thủ công trước deploy production)

### Commands

| Check | Result | Notes |
|------|--------|-------|
| `npm run lint` | Pass | 0 errors, 710 warnings (chủ yếu no-unused-vars cũ) |
| `npm test` | Pass | 20 files, 164 tests |
| `npm run test:migration` | Pass | 40 tests |
| `npm run test:rules` | Pass | 2 files, 50 tests (Firestore emulator) |
| `npm run build` | Pass | Vite 8 build OK |
| `npm run audit:security:gate` | Fail | High/critical trong chuỗi dev tooling (`tar`, `react-router` 7.18.1, `postcss`, …); xem `docs/SECURITY_AUDIT_NOTES.md` |
| `npm run ci` | Fail | Dừng ở audit gate; cân nhắc `npm audit fix` (không `--force`) trước push |

### Manual Flows

| Flow | Result | Notes |
|------|--------|-------|
| Admin login + Dashboard | Not run | |
| HS phase học: `/learn` auto-open | Not run | |
| HS final/project: nav Dự án ↔ Bài giảng + `/lessons` | Not run | |
| HTML lesson preview (admin) | Not run | |
| Project report flow | Not run | |
| Spy admin + student tabs | Not run | |

### Issues

- Sau push: chạy `npm run deploy:firestore` (rules Spy crew + đề xuất dự án; đã gỡ `caseSessions`).
- Browser smoke bắt buộc trước deploy Netlify production.

## 2026-06-30 Local Verification

- Date: 2026-06-30
- Branch: `maintenance/next-upgrades`
- Commit: `e5a9b52` plus uncommitted maintenance changes
- Environment: Windows local workspace
- Tester: Codex
- Node: `v24.14.0` (allowed by `>=22.12.0 <25`; CI uses Node 22)
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
| Settings backup JSON | Not run | Needs browser smoke test |
| Student portal + lesson HTML/Markdown/lightbox | Not run | Needs browser smoke test |
| HS `/learn` auto-open + final/project nav | Not run | Needs browser smoke test |
| Feedback submit + reload | Not run | Only if `FEATURE_KNOWLEDGE_FEEDBACK_ENABLED` |
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
- Node: `v24.14.0` (allowed by `>=22.12.0 <25`; CI uses Node 22)
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
| Settings backup JSON | Not run | Needs browser smoke test |
| Student portal + lesson HTML/Markdown/lightbox | Not run | Needs browser smoke test |
| HS `/learn` auto-open + final/project nav | Not run | Needs browser smoke test |
| Feedback submit + reload | Not run | Only if `FEATURE_KNOWLEDGE_FEEDBACK_ENABLED` |
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
| Settings backup JSON | Not run | |
| Student portal + lesson HTML/Markdown/lightbox | Not run | |
| HS `/learn` auto-open + final/project nav | Not run | |
| Feedback submit + reload | Not run | Only if feedback flag enabled |
| Project report flow | Not run | |
| Showdown admin + student tabs | Not run | |
| Spy admin + student tabs | Not run | |

### Issues

- None recorded.
