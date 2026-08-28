## Summary

- 

## Verification

- [ ] `npm ci`
- [ ] `npm run ci` (lint, test, test:migration, test:rules, build, audit gate)
- [ ] `npm run audit:security:full` reviewed; known moderate tooling items only

## Smoke Test

- [ ] Results recorded in `docs/SMOKE_TEST_RESULTS.md`
- [ ] Admin login, Dashboard, Settings health, backup JSON
- [ ] Student portal: `/learn` auto-open lesson; final/project nav **Dự án | Bài giảng** + `/lessons`
- [ ] HTML lesson preview in admin Bài giảng
- [ ] Project report flow (final/project)
- [ ] Spy checked with admin + student tabs (Showdown if flag enabled)

## Firestore / Deploy Notes

- [ ] No Firestore schema change
- [ ] Route changes documented (if any)
- [ ] No production deploy performed from this PR
- [ ] If rules/indexes changed, deploy plan is documented
