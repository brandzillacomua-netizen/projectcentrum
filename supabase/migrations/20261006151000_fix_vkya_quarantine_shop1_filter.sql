-- ═══════════════════════════════════════════════════════════════════════════
-- CENTRUM MES v2.0 — FIX VKYA QUARANTINE FILTER FOR SHOP 1 UNCLASSIFIED SCRAP
-- ═══════════════════════════════════════════════════════════════════════════
-- Migration: 20261006151000_fix_vkya_quarantine_shop1_filter.sql
-- Purpose:
--   Removes the restrictive filter (is_archived_scrap = true OR card_info LIKE '%[ЦЕХ №2]%')
--   from VKYA classification queue projection functions so all live Shop 1 and Shop 2 scrap
--   records flow directly into the VKYA Quarantine queue.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.sync_vkya_history_queue_projection()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_resolved numeric;
  v_ready boolean;
BEGIN
  SELECT
    coalesce((SELECT sum(quantity) FROM public.scrap_classifications WHERE source_history_id = NEW.id), 0)
    + coalesce((SELECT sum(quantity) FROM public.vkya_quality_resolutions WHERE source_history_id = NEW.id), 0)
  INTO v_resolved;

  v_ready := coalesce(NEW.scrap_qty, 0) > v_resolved;

  INSERT INTO public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) VALUES (
    'history', NEW.id,
    to_jsonb(NEW) || jsonb_build_object('classified_quantity', v_resolved),
    v_ready, NEXTVAL('public.vkya_classification_queue_change_seq'), clock_timestamp()
  ) ON CONFLICT (source_type, source_id) DO UPDATE SET
    payload = EXCLUDED.payload,
    is_active = EXCLUDED.is_active,
    change_seq = EXCLUDED.change_seq,
    changed_at = EXCLUDED.changed_at;
  RETURN NEW;
END;
$body$;

CREATE OR REPLACE FUNCTION public.sync_vkya_projection_after_classification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $classification$
DECLARE
  v_history public.work_card_history%rowtype;
  v_classified numeric;
BEGIN
  IF NEW.source_history_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO v_history FROM public.work_card_history WHERE id = NEW.source_history_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT
    coalesce((SELECT sum(quantity) FROM public.scrap_classifications WHERE source_history_id = NEW.source_history_id), 0)
    + coalesce((SELECT sum(quantity) FROM public.vkya_quality_resolutions WHERE source_history_id = NEW.source_history_id), 0)
  INTO v_classified;

  INSERT INTO public.vkya_classification_queue_projection (
    source_type, source_id, payload, is_active, change_seq, changed_at
  ) VALUES (
    'history', v_history.id,
    to_jsonb(v_history) || jsonb_build_object('classified_quantity', v_classified),
    coalesce(v_history.scrap_qty, 0) > v_classified,
    NEXTVAL('public.vkya_classification_queue_change_seq'), clock_timestamp()
  )
  ON CONFLICT (source_type, source_id) DO UPDATE SET
    payload = EXCLUDED.payload,
    is_active = EXCLUDED.is_active,
    change_seq = EXCLUDED.change_seq,
    changed_at = EXCLUDED.changed_at;
  RETURN NEW;
END;
$classification$;

-- Backfill / sync all existing scrap history records into the projection table
INSERT INTO public.vkya_classification_queue_projection (
  source_type, source_id, payload, is_active
)
SELECT
  'history', h.id,
  to_jsonb(h) || jsonb_build_object(
    'classified_quantity',
    coalesce((SELECT sum(c.quantity) FROM public.scrap_classifications c WHERE c.source_history_id = h.id), 0)
    + coalesce((SELECT sum(r.quantity) FROM public.vkya_quality_resolutions r WHERE r.source_history_id = h.id), 0)
  ),
  (
    coalesce(h.scrap_qty, 0) > (
      coalesce((SELECT sum(c.quantity) FROM public.scrap_classifications c WHERE c.source_history_id = h.id), 0)
      + coalesce((SELECT sum(r.quantity) FROM public.vkya_quality_resolutions r WHERE r.source_history_id = h.id), 0)
    )
  )
FROM public.work_card_history h
WHERE coalesce(h.scrap_qty, 0) > 0
ON CONFLICT (source_type, source_id) DO UPDATE SET
  payload = EXCLUDED.payload,
  is_active = EXCLUDED.is_active,
  change_seq = NEXTVAL('public.vkya_classification_queue_change_seq'),
  changed_at = clock_timestamp();
