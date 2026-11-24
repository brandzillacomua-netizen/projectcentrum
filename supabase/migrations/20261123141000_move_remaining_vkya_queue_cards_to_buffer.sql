-- Move any remaining open ('new' or 'at-buffer') VKYA / rework / restoration cards
-- out of the Shop 2 operator queue into the Shop 2 Input Buffer ('at-shop2-buffer').

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

DO $move_vkya_queue$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, nomenclature_id, coalesce(quantity, 0) AS qty, card_info
    FROM public.work_cards
    WHERE status IN ('new', 'at-buffer')
      AND coalesce(card_info, '') NOT ILIKE '%[SHOP:2]%'
      AND (
        coalesce(is_rework, false) = true
        OR coalesce(card_info, '') ILIKE '%VKYA%'
        OR coalesce(card_info, '') ILIKE '%ВКЯ%'
        OR coalesce(card_info, '') ILIKE '%[REWORK]%'
        OR coalesce(card_info, '') ILIKE '%[RESTORATION]%'
      )
  LOOP
    UPDATE public.work_cards
    SET status = 'at-shop2-buffer',
        operation = 'Доопрацювання',
        card_info = regexp_replace(coalesce(card_info, ''), '\[ЦЕХ №2\]', '[VKYA_RETURN]', 'g')
    WHERE id = v_rec.id;

    -- Add semi_shop2 only if it wasn't already added via [VKYA_RETURN]
    IF v_rec.nomenclature_id IS NOT NULL
       AND v_rec.qty > 0
       AND coalesce(v_rec.card_info, '') NOT ILIKE '%[VKYA_RETURN]%'
    THEN
      PERFORM public.vkya_add_route_inventory(v_rec.nomenclature_id, 'semi_shop2', v_rec.qty);
    END IF;
  END LOOP;
END $move_vkya_queue$;

COMMIT;
