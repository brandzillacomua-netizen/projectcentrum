-- ─────────────────────────────────────────────────────────────────────────────
-- Fix foreign key constraints on ALL production and quality tables to allow
-- ON DELETE CASCADE when deleting orders, tasks, or work cards
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. work_cards -> orders
ALTER TABLE work_cards
  DROP CONSTRAINT IF EXISTS work_cards_order_id_fkey;
ALTER TABLE work_cards
  ADD CONSTRAINT work_cards_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 2. work_card_history -> work_cards
ALTER TABLE work_card_history
  DROP CONSTRAINT IF EXISTS work_card_history_card_id_fkey;
ALTER TABLE work_card_history
  ADD CONSTRAINT work_card_history_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES work_cards(id) ON DELETE CASCADE;

-- 3. cutter_usage_events -> work_cards & orders
ALTER TABLE cutter_usage_events
  DROP CONSTRAINT IF EXISTS cutter_usage_events_source_card_id_fkey,
  DROP CONSTRAINT IF EXISTS cutter_usage_events_order_id_fkey;
ALTER TABLE cutter_usage_events
  ADD CONSTRAINT cutter_usage_events_source_card_id_fkey
    FOREIGN KEY (source_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT cutter_usage_events_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 4. cutter_restoration_batches -> work_cards & orders
ALTER TABLE cutter_restoration_batches
  DROP CONSTRAINT IF EXISTS cutter_restoration_batches_source_card_id_fkey,
  DROP CONSTRAINT IF EXISTS cutter_restoration_batches_order_id_fkey;
ALTER TABLE cutter_restoration_batches
  ADD CONSTRAINT cutter_restoration_batches_source_card_id_fkey
    FOREIGN KEY (source_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT cutter_restoration_batches_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 5. vkya_quality_resolutions -> work_cards & orders
ALTER TABLE vkya_quality_resolutions
  DROP CONSTRAINT IF EXISTS vkya_quality_resolutions_source_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_quality_resolutions_route_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_quality_resolutions_order_id_fkey;
ALTER TABLE vkya_quality_resolutions
  ADD CONSTRAINT vkya_quality_resolutions_source_card_id_fkey
    FOREIGN KEY (source_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_quality_resolutions_route_card_id_fkey
    FOREIGN KEY (route_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_quality_resolutions_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 6. vkya_restoration_cards -> work_cards & orders
ALTER TABLE vkya_restoration_cards
  DROP CONSTRAINT IF EXISTS vkya_restoration_cards_source_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_restoration_cards_route_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_restoration_cards_source_order_id_fkey;
ALTER TABLE vkya_restoration_cards
  ADD CONSTRAINT vkya_restoration_cards_source_card_id_fkey
    FOREIGN KEY (source_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_restoration_cards_route_card_id_fkey
    FOREIGN KEY (route_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_restoration_cards_source_order_id_fkey
    FOREIGN KEY (source_order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 7. vkya_reclassification_queue -> work_cards & orders
ALTER TABLE vkya_reclassification_queue
  DROP CONSTRAINT IF EXISTS vkya_reclassification_queue_source_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_reclassification_queue_source_order_id_fkey;
ALTER TABLE vkya_reclassification_queue
  ADD CONSTRAINT vkya_reclassification_queue_source_card_id_fkey
    FOREIGN KEY (source_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_reclassification_queue_source_order_id_fkey
    FOREIGN KEY (source_order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 8. work_card_scrap_totals -> work_cards & orders
ALTER TABLE work_card_scrap_totals
  DROP CONSTRAINT IF EXISTS work_card_scrap_totals_card_id_fkey,
  DROP CONSTRAINT IF EXISTS work_card_scrap_totals_order_id_fkey;
ALTER TABLE work_card_scrap_totals
  ADD CONSTRAINT work_card_scrap_totals_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT work_card_scrap_totals_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
