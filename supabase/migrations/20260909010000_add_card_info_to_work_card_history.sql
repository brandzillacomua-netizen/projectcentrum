-- Migration: Add missing columns to work_card_history
-- Fixes: "Could not find the 'card_info' column of 'work_card_history' in the schema cache"
-- The staging_clean_schema.sql had an outdated definition of work_card_history.
-- This migration brings existing DBs up to the full schema.

ALTER TABLE public.work_card_history
  ADD COLUMN IF NOT EXISTS nomenclature_id uuid,
  ADD COLUMN IF NOT EXISTS stage_name text,
  ADD COLUMN IF NOT EXISTS operator_name text,
  ADD COLUMN IF NOT EXISTS qty_at_start bigint,
  ADD COLUMN IF NOT EXISTS qty_completed bigint,
  ADD COLUMN IF NOT EXISTS scrap_qty bigint,
  ADD COLUMN IF NOT EXISTS started_at text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_archived_scrap boolean,
  ADD COLUMN IF NOT EXISTS machine text,
  ADD COLUMN IF NOT EXISTS machine_id uuid,
  ADD COLUMN IF NOT EXISTS manager_name text,
  ADD COLUMN IF NOT EXISTS shift_name text,
  ADD COLUMN IF NOT EXISTS machine_name text,
  ADD COLUMN IF NOT EXISTS cutters_used bigint,
  ADD COLUMN IF NOT EXISTS qc_scrap_reason text,
  ADD COLUMN IF NOT EXISTS qc_scrap_comment text,
  ADD COLUMN IF NOT EXISTS galt_priority bigint,
  ADD COLUMN IF NOT EXISTS card_info text,
  ADD COLUMN IF NOT EXISTS task_id uuid;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
