---
description: Planning, verification, and truthfulness workflow rules for Centrum MES
---

# Engineering Workflow & Verification Gates

## 1. Plan Before Risky Changes
- Before modifying core workflows, database schemas, or multi-file architecture, briefly diagnose the root cause from actual code/data and present a clear, low-risk plan.
- When diagnosing production issues, inspect `git log`, actual hooks/RPCs, and DB telemetry rather than guessing.

## 2. Mandatory Pre-Completion Checks
After code or migration edits, run and verify (do not claim passing unless actually observed after the final edit):
1. `npm run typecheck` (`tsc --noEmit`) — must pass with 0 errors.
2. `npm run validate:migrations` — whenever `supabase/migrations/` is touched.
3. Relevant unit tests (`npx vitest run <test-file>`) for modified calculation/data logic.
4. Production build (`npm run build` or `npx vite build --configLoader native ...`) — must succeed cleanly.

## 3. Strict Truthfulness
- Only cite file paths, symbol names, SQL columns, and test/build results directly observed in this session.
- If a check fails or cannot run in the environment, report the exact failure honestly instead of skipping or glossing over it.
