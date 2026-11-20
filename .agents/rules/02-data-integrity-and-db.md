---
description: Data integrity, database performance, and Supabase security rules for Centrum MES
---

# Data Integrity, Database Performance & Security Rules

## 1. Zero Fake Success (Truthful Persistence)
- **NEVER** return `{ success: true }` when a Supabase/DB write fails.
- **NEVER** silently fall back to `localStorage` as if data were saved globally (causing "ghost" orders/requests visible only on one device, as happened with `rubberCuttingService.js`).
- If an operation fails: roll back optimistic local state, throw or return an explicit error, and display a clear Ukrainian error message to the user.

## 2. Fresh State on Terminals & Scanners
- **Scanners (QR / Barcode)** in all shop terminals (`Shop1`, `Tumbling`, `Reception`, `Sorting`, `Shop2`, etc.) must **always** fetch the fresh row from `work_cards` by primary key `id` (`select('*').eq('id', id).maybeSingle()`) before opening start/complete modals. Never trust potentially stale in-memory `workCards` alone.
- After a successful transition, immediately update local state (`setWorkCards`) and trigger `fetchData(..., { force: true })` for affected tables.

## 3. Atomic Transitions & Forward-Only State Machine
- All work card status/stage transitions must go through server-side atomic RPCs (`executeAtomicCardTransition` / `rpc_transition_work_card_atomic` or equivalent), never raw client `UPDATE`s that bypass conflict/idempotency checks.
- Shop 1 stage transitions are strictly forward-only (`mes_shop1_stage_rank`) unless explicitly flagged `is_rework = true`.

## 4. Database & Server Resource Protection (2–4 GB RAM Budget)
- **No Polling/Ping Storms**: Never attach unthrottled queries to `sys_sync_pings` or Realtime events. Preserve coalescing/debouncing and pause background sync when `document.visibilityState === 'hidden'` (`src/contexts/data/dataRealtime.js`).
- **No Unbounded `SELECT *` in New Features**: Always filter by `status`, `task_id`, `order_id`, date range, or explicit column list (`select('id, ...')`), avoiding heavy JSONB columns like `plan_snapshot` when not needed.
- **Pagination Over Silent Truncation**: Never rely on `.limit(10000)` to fetch >1000 rows from PostgREST; use `.range(from, from + pageSize - 1)` loops where datasets can exceed 1000 rows.
- **Projection & Cache Tables**: Any append/tombstone projection table (like `vkya_classification_queue_projection`) must have bounded retention or cleanup strategy and must never be confused with primary source-of-truth tables.

## 5. SQL Migration & RLS Hygiene
- Wrap table/policy alterations in `IF to_regclass('public.<table>') IS NOT NULL` when touching optional/recent tables so migrations are idempotent.
- **Strictly Forbidden** in migrations:
  - `PUBLIC` or `anon` write/mutating privileges (`INSERT`, `UPDATE`, `DELETE`, `FOR ALL`).
  - `GRANT ALL ... TO authenticated` or `FOR ALL TO authenticated` (use explicit `SELECT, INSERT, UPDATE, DELETE` policies).
  - `SECURITY DEFINER` functions without `SET search_path = pg_catalog, public, auth`.
  - Anonymous `EXECUTE` grants on RPCs (except explicitly public machine-call endpoints).
