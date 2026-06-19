-- Migration: Add group_label column to bom_items
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/hurzutjytlcvtbvihnry/sql)
-- This enables grouping of BOM items by category (e.g. Деталі, Метизи, Сировина, etc.)

ALTER TABLE bom_items 
  ADD COLUMN IF NOT EXISTS group_label TEXT DEFAULT 'Деталі';

-- Optional: verify
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'bom_items' AND column_name = 'group_label';
