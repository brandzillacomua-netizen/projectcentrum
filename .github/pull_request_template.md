## What changed

Describe the user-visible result and the reason for this change.

## Risk and rollback

- Risk level: low / medium / high
- Rollback procedure or migration rollback file:
- Production data affected: no / read-only / yes (explain)

## Required verification

- [ ] `npm run ci` passes locally or in GitHub Actions
- [ ] No secret, service-role key, password, token, or production export is committed
- [ ] New or changed database access is covered by RLS/RBAC tests
- [ ] A database migration is additive/idempotent or has an explicit rollback
- [ ] Critical workflow changes have a regression test
- [ ] Production deployment SHA will be verified by the release gate

## Manual checks

List the exact role, screen, and workflow checked. Use `Not applicable` only with a reason.
