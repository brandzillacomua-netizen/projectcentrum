-- ─────────────────────────────────────────────────────────────────────────────
-- Fix foreign key constraints on work_cards, work_card_history, and cutter_usage_events
-- to allow ON DELETE CASCADE when deleting orders or work cards
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. work_cards -> orders
ALTER TABLE work_cards
  DROP CONSTRAINT IF EXISTS work_cards_order_id_fkey;

ALTER TABLE work_cards
  ADD CONSTRAINT work_cards_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE;

-- 2. work_card_history -> work_cards
ALTER TABLE work_card_history
  DROP CONSTRAINT IF EXISTS work_card_history_card_id_fkey;

ALTER TABLE work_card_history
  ADD CONSTRAINT work_card_history_card_id_fkey
    FOREIGN KEY (card_id)
    REFERENCES work_cards(id)
    ON DELETE CASCADE;

-- 3. cutter_usage_events -> work_cards & orders
ALTER TABLE cutter_usage_events
  DROP CONSTRAINT IF EXISTS cutter_usage_events_source_card_id_fkey;

ALTER TABLE cutter_usage_events
  ADD CONSTRAINT cutter_usage_events_source_card_id_fkey
    FOREIGN KEY (source_card_id)
    REFERENCES work_cards(id)
    ON DELETE CASCADE;

ALTER TABLE cutter_usage_events
  DROP CONSTRAINT IF EXISTS cutter_usage_events_order_id_fkey;

ALTER TABLE cutter_usage_events
  ADD CONSTRAINT cutter_usage_events_order_id_fkey
    FOREIGN KEY (order_id)
    REFERENCES orders(id)
    ON DELETE CASCADE;
