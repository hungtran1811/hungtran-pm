## Summary

- 

## Verification

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run test:rules`
- [ ] `npm run build`
- [ ] `npm run audit:security:gate`
- [ ] `npm run audit:security:full` reviewed; known moderate tooling items only

## Smoke Test

- [ ] Results recorded in `docs/SMOKE_TEST_RESULTS.md`
- [ ] Admin login, Dashboard, Settings health, backup JSON
- [ ] Student portal, lesson Markdown/lightbox, feedback reload
- [ ] Practice quiz and exam quiz submit/reload
- [ ] Project report flow
- [ ] Showdown and Spy checked with admin + student tabs

## Firestore / Deploy Notes

- [ ] No Firestore schema change
- [ ] No route change
- [ ] No production deploy performed from this PR
- [ ] If rules/indexes changed, deploy plan is documented
