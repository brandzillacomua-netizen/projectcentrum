# CENTRUM MES — Backup and Restore Drill

## Purpose

Prove that a production database backup can be restored into an isolated Supabase staging project without changing production. A backup is not considered verified until a restore drill passes.

## Safety boundaries

- Never restore into project `hurzutjytlcvtbvihnry`; it is production.
- Use a separate Supabase project with no production integrations or customer traffic.
- Store connection strings only in an ignored local environment file or an approved secret manager.
- Do not commit dumps. Dumps can contain personal and operational data.
- Do not use `supabase db reset --linked` against any hosted project.
- Stop immediately if the preflight reports `BLOCKED`.

## Required tooling and inputs

1. Supabase CLI and Docker Desktop.
2. PostgreSQL `psql` client.
3. Production and isolated staging connection strings from Supabase Dashboard.
4. A timestamped encrypted directory outside the repository for dump files and evidence.

Run the repository guard before creating or restoring a dump:

```powershell
$env:PRODUCTION_DATABASE_URL = '<production connection string>'
$env:RESTORE_TARGET_DATABASE_URL = '<isolated staging connection string>'
$env:RESTORE_DRILL_CONFIRMATION = 'ISOLATED_STAGING_ONLY'
npm run backup:preflight
```

## Logical backup

Follow the current Supabase backup/restore guide. Export roles, schema, and data separately with `supabase db dump`; use `--use-copy --data-only` for the data export. Record the start/end time, tool versions, file sizes, and SHA-256 hashes.

Supabase-managed backups do not restore deleted Storage objects; the database backup contains only Storage metadata. Storage objects therefore require a separate documented backup policy.

## Restore into isolated staging

1. Re-run `npm run backup:preflight` immediately before restore.
2. Verify the target project reference in Supabase Dashboard.
3. Restore roles, schema, migration history, and data according to the official Supabase procedure.
4. Treat every restore warning as a failure until reviewed.
5. Never redirect application production traffic to the restore target.

## Acceptance checks

- Schema, functions, triggers, RLS policies, grants, extensions, and migration history exist.
- Critical table row counts are recorded and reconciled with the source snapshot.
- An anonymous request cannot read protected tables or execute privileged RPCs.
- A dedicated audit user can sign in and read only its allowed scope.
- `npm run smoke:atomic-transition` equivalent passes against staging.
- Critical Cех №1 workflow passes end-to-end on synthetic records.
- File hashes, evidence, elapsed restore time, and discovered gaps are recorded.

## Recovery objectives

Do not claim an RPO or RTO before measurement. After the first successful drill:

- **Measured RPO:** difference between the backup recovery point and drill start.
- **Measured RTO:** time from restore authorization to all acceptance checks passing.
- **Target:** approved by the system owner based on the measured result and business tolerance.

## Completion artifact

A drill is complete only when evidence contains the backup timestamp and hashes, source and target project references, tool versions, row-count reconciliation, security smoke results, measured RPO/RTO, reviewer, and final PASS/FAIL decision.
