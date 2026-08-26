-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Add custom Kanban columns to task_projects table
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE task_projects
  ADD COLUMN IF NOT EXISTS columns jsonb DEFAULT '[]'::jsonb;
