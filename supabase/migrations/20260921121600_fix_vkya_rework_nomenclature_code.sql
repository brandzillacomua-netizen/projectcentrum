-- Migration: Fix create_vkya_rework_from_lot column "nomenclature_code" error
-- risk: low
-- transaction: transactional

BEGIN;

CREATE OR REPLACE FUNCTION public.create_vkya_rework_from_lot(
  p_classification_category_id bigint,
  p_quantity integer,
  p_created_by_user_id bigint default null,
  p_created_by_name text default null
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_category public.scrap_classification_categories%rowtype;
  v_classification public.scrap_classifications%rowtype;
  v_allocated numeric;
  v_available numeric;
  v_storage_type text;
  v_name text;
  v_code text;
  v_order_number text;
  v_order_id uuid;
  v_task_id uuid;
  v_card_id uuid;
BEGIN
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'Кількість має бути більшою за нуль'; END IF;

  SELECT * INTO v_category FROM public.scrap_classification_categories
  WHERE id = p_classification_category_id FOR UPDATE;
  IF NOT FOUND OR v_category.category NOT IN (1, 2, 3) THEN RAISE EXCEPTION 'Партію браку не знайдено'; END IF;

  SELECT * INTO v_classification FROM public.scrap_classifications
  WHERE id = v_category.classification_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Класифікацію партії не знайдено'; END IF;

  SELECT coalesce(sum(quantity), 0) INTO v_allocated
  FROM public.vkya_scrap_lot_allocations
  WHERE classification_category_id = v_category.id;
  v_available := v_category.quantity - v_allocated;
  IF p_quantity > v_available THEN RAISE EXCEPTION 'У партії доступно лише % шт.', greatest(0, v_available); END IF;

  v_storage_type := CASE WHEN v_category.category = 2 THEN 'scrap_cat_2' ELSE 'scrap_cat_1' END;
  PERFORM public.vkya_take_recoverable_scrap(v_classification.nomenclature_id, v_storage_type, p_quantity);

  SELECT n.name, coalesce(v2.code, '') INTO v_name, v_code
  FROM public.nomenclatures n
  LEFT JOIN public.nomenclatures_v2 v2 ON v2.id = n.id
  WHERE n.id = v_classification.nomenclature_id;

  PERFORM pg_advisory_xact_lock(hashtextextended('vkya-rework-order-number', 0));
  SELECT 'ВБ' || lpad((coalesce(max(substring(order_num FROM '^ВБ([0-9]+)$')::integer), 0) + 1)::text, 4, '0')
  INTO v_order_number
  FROM public.orders
  WHERE order_num ~ '^ВБ[0-9]+$';

  INSERT INTO public.orders (order_num, customer, status)
  VALUES (v_order_number, 'ВНУТРІШНЄ ДООПРАЦЮВАННЯ', 'in-progress')
  RETURNING id INTO v_order_id;

  INSERT INTO public.tasks (
    order_id, step, status, machine_name, estimated_time,
    engineer_conf, warehouse_conf, director_conf, plan_snapshot, planned_sets
  ) VALUES (
    v_order_id, 'Доопрацювання', 'waiting', 'Доопрацювання', 0,
    true, 'true', true,
    jsonb_build_object(v_classification.nomenclature_id::text, jsonb_build_object(
      'id', v_classification.nomenclature_id,
      'name', coalesce(v_name, 'Деталь'),
      'code', coalesce(v_code, '—'),
      'need', p_quantity,
      'stock', 0,
      'plan', p_quantity,
      'is_rework', true,
      'source_order_id', v_classification.order_id,
      'source_task_id', v_classification.task_id,
      'source_card_id', v_classification.card_id,
      'source_classification_id', v_classification.id
    )),
    0
  ) RETURNING id INTO v_task_id;

  INSERT INTO public.work_cards (
    task_id, order_id, nomenclature_id, quantity, status, operation, card_info
  ) VALUES (
    v_task_id, v_order_id, v_classification.nomenclature_id, p_quantity,
    'new', 'Доопрацювання',
    format('[REWORK] [ЦЕХ №2] [VKYA_LOT:%s] [SOURCE_ORDER:%s] [SOURCE_TASK:%s] [SOURCE_CARD:%s] %s — ДООПРАЦЮВАННЯ БРАКУ',
      v_category.id, v_classification.order_id, v_classification.task_id,
      v_classification.card_id, coalesce(v_name, 'Деталь'))
  ) RETURNING id INTO v_card_id;

  INSERT INTO public.vkya_scrap_lot_allocations (
    classification_category_id, quantity, action,
    rework_order_id, rework_task_id, rework_card_id,
    allocated_by_user_id, allocated_by_name
  ) VALUES (
    v_category.id, p_quantity, 'rework_order',
    v_order_id, v_task_id, v_card_id,
    p_created_by_user_id, nullif(btrim(p_created_by_name), '')
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'task_id', v_task_id,
    'card_id', v_card_id,
    'order_number', v_order_number
  );
END;
$body$;

COMMIT;
