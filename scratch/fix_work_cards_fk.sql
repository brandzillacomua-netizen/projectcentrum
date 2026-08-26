-- ─────────────────────────────────────────────────────────────────────────────
-- Fix foreign key constraints on ALL production, quality, cutter, and allocation tables
-- to allow ON DELETE CASCADE when deleting orders, tasks, work cards, or batches
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

-- 5. cutter_restoration_events -> cutter_restoration_batches
ALTER TABLE cutter_restoration_events
  DROP CONSTRAINT IF EXISTS cutter_restoration_events_batch_id_fkey;
ALTER TABLE cutter_restoration_events
  ADD CONSTRAINT cutter_restoration_events_batch_id_fkey
    FOREIGN KEY (batch_id) REFERENCES cutter_restoration_batches(id) ON DELETE CASCADE;

-- 6. vkya_quality_resolutions -> work_cards & orders
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

-- 7. vkya_restoration_cards -> work_cards & orders
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

-- 8. vkya_scrap_lot_allocations -> vkya_restoration_cards, work_cards, tasks, orders
ALTER TABLE vkya_scrap_lot_allocations
  DROP CONSTRAINT IF EXISTS vkya_scrap_lot_allocations_restoration_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_scrap_lot_allocations_rework_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_scrap_lot_allocations_rework_task_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_scrap_lot_allocations_rework_order_id_fkey;
ALTER TABLE vkya_scrap_lot_allocations
  ADD CONSTRAINT vkya_scrap_lot_allocations_restoration_card_id_fkey
    FOREIGN KEY (restoration_card_id) REFERENCES vkya_restoration_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_scrap_lot_allocations_rework_card_id_fkey
    FOREIGN KEY (rework_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_scrap_lot_allocations_rework_task_id_fkey
    FOREIGN KEY (rework_task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_scrap_lot_allocations_rework_order_id_fkey
    FOREIGN KEY (rework_order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 9. vkya_reclassification_queue -> work_cards & orders
ALTER TABLE vkya_reclassification_queue
  DROP CONSTRAINT IF EXISTS vkya_reclassification_queue_source_card_id_fkey,
  DROP CONSTRAINT IF EXISTS vkya_reclassification_queue_source_order_id_fkey;
ALTER TABLE vkya_reclassification_queue
  ADD CONSTRAINT vkya_reclassification_queue_source_card_id_fkey
    FOREIGN KEY (source_card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT vkya_reclassification_queue_source_order_id_fkey
    FOREIGN KEY (source_order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- 10. work_card_scrap_totals -> work_cards & orders
ALTER TABLE work_card_scrap_totals
  DROP CONSTRAINT IF EXISTS work_card_scrap_totals_card_id_fkey,
  DROP CONSTRAINT IF EXISTS work_card_scrap_totals_order_id_fkey;
ALTER TABLE work_card_scrap_totals
  ADD CONSTRAINT work_card_scrap_totals_card_id_fkey
    FOREIGN KEY (card_id) REFERENCES work_cards(id) ON DELETE CASCADE,
  ADD CONSTRAINT work_card_scrap_totals_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;
