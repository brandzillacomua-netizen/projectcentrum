-- Route all VKYA restoration & rework transfers to Shop 2 Input Buffer (at-shop2-buffer)
-- instead of creating 'new' cards directly in the Shop 2 operator queue.

SET lock_timeout = '5s';
SET statement_timeout = '60s';

BEGIN;

CREATE OR REPLACE FUNCTION public.dispatch_vkya_restoration_to_shop2(
  p_restoration_card_id uuid,
  p_shop2_stage text default 'Буфер Цеху №2'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_restoration public.vkya_restoration_cards%rowtype;
  v_shop2_card_id uuid;
  v_stage text;
  v_route_tag text;
BEGIN
  v_stage := btrim(coalesce(p_shop2_stage, ''));
  IF v_stage = '' THEN
    v_stage := 'Буфер Цеху №2';
  END IF;
  IF v_stage NOT IN ('Буфер Цеху №2', 'Доопрацювання', 'Пресування', 'Фарбування') THEN
    RAISE EXCEPTION 'Дозволені етапи: Буфер Цеху №2, Доопрацювання, Пресування або Фарбування';
  END IF;

  SELECT * INTO v_restoration
  FROM public.vkya_restoration_cards
  WHERE id = p_restoration_card_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Карту відновлення не знайдено'; END IF;
  IF v_restoration.route_card_id IS NOT NULL THEN
    RAISE EXCEPTION 'Відновлені деталі вже повернено в початковий наряд';
  END IF;
  IF v_restoration.status <> 'completed' THEN RAISE EXCEPTION 'Спочатку завершіть карту відновлення'; END IF;
  IF v_restoration.completed_quantity <= 0 THEN RAISE EXCEPTION 'Немає відновлених деталей для передачі'; END IF;
  IF v_restoration.shop2_card_id IS NOT NULL THEN RETURN v_restoration.shop2_card_id; END IF;

  v_route_tag := CASE WHEN v_restoration.source_task_id IS NOT NULL THEN '[VKYA_SOURCE_ROUTE]' ELSE '[VKYA_LEGACY_BZ]' END;

  INSERT INTO public.work_cards (
    task_id, order_id, nomenclature_id, quantity, operation, status, machine, card_info
  ) VALUES (
    v_restoration.source_task_id,
    v_restoration.source_order_id,
    v_restoration.nomenclature_id,
    v_restoration.completed_quantity,
    'Доопрацювання',
    'at-shop2-buffer',
    '—',
    format('[VKYA_RETURN] [VKYA_RESTORATION] %s [VKYA_CARD:%s] %s — В БУФЕР ЦЕХУ №2 ПІСЛЯ ВІДНОВЛЕННЯ ВКЯ',
      v_route_tag, v_restoration.card_number, v_restoration.nomenclature_name)
  ) RETURNING id INTO v_shop2_card_id;

  IF v_restoration.nomenclature_id IS NOT NULL THEN
    PERFORM public.vkya_add_route_inventory(
      v_restoration.nomenclature_id,
      'semi_shop2',
      v_restoration.completed_quantity
    );
  END IF;

  UPDATE public.vkya_restoration_cards SET
    shop2_card_id = v_shop2_card_id,
    shop2_stage = 'Буфер Цеху №2',
    transferred_to_shop2_at = now(),
    updated_at = now()
  WHERE id = v_restoration.id;

  RETURN v_shop2_card_id;
END;
$body$;

REVOKE ALL ON FUNCTION public.dispatch_vkya_restoration_to_shop2(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_vkya_restoration_to_shop2(uuid, text) TO anon, authenticated;

DO $guard_rework$
BEGIN
  IF to_regclass('public.vkya_classification_categories') IS NOT NULL THEN
    EXECUTE $fn$
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
        v_category public.vkya_classification_categories%rowtype;
        v_classification public.vkya_quality_classifications%rowtype;
        v_lot_allocated integer := 0;
        v_available integer := 0;
        v_max_vb integer := 0;
        v_order_number text;
        v_order_id uuid;
        v_task_id uuid;
        v_card_id uuid;
        v_name text;
        v_code text;
      BEGIN
        IF p_quantity IS NULL OR p_quantity <= 0 THEN
          RAISE EXCEPTION 'Кількість має бути більшою за 0';
        END IF;

        SELECT * INTO v_category
        FROM public.vkya_classification_categories
        WHERE id = p_classification_category_id
        FOR UPDATE;

        IF NOT FOUND THEN RAISE EXCEPTION 'Позицію класифікації не знайдено'; END IF;
        IF v_category.category_code <> 2 THEN
          RAISE EXCEPTION 'На доопрацювання можна передавати лише категорію Брак (2)';
        END IF;

        SELECT * INTO v_classification
        FROM public.vkya_quality_classifications
        WHERE id = v_category.classification_id;

        SELECT coalesce(sum(quantity), 0)::integer INTO v_lot_allocated
        FROM public.vkya_scrap_lot_allocations
        WHERE classification_category_id = v_category.id;

        v_available := greatest(0, v_category.quantity - v_lot_allocated);
        IF p_quantity > v_available THEN
          RAISE EXCEPTION 'Доступно лише % шт.', v_available;
        END IF;

        PERFORM public.vkya_take_scrap_ready(v_classification.nomenclature_id, p_quantity);

        SELECT coalesce(max(substring(order_num FROM '^ВБ(\d+)$')::integer), 0)
        INTO v_max_vb
        FROM public.orders
        WHERE order_num ~ '^ВБ\d+$';

        v_order_number := 'ВБ' || lpad((v_max_vb + 1)::text, 4, '0');

        INSERT INTO public.orders (order_num, customer, status)
        VALUES (v_order_number, 'ВНУТРІШНЄ ДООПРАЦЮВАННЯ', 'in-progress')
        RETURNING id INTO v_order_id;

        SELECT n.name, coalesce(nullif(btrim(n.code), ''), nullif(btrim(n.nomenclature_code), ''))
        INTO v_name, v_code
        FROM public.nomenclatures n
        WHERE n.id = v_classification.nomenclature_id;

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
          task_id, order_id, nomenclature_id, quantity, status, operation, machine, card_info
        ) VALUES (
          v_task_id, v_order_id, v_classification.nomenclature_id, p_quantity,
          'at-shop2-buffer', 'Доопрацювання', '—',
          format('[VKYA_RETURN] [REWORK] [VKYA_LOT:%s] [SOURCE_ORDER:%s] [SOURCE_TASK:%s] [SOURCE_CARD:%s] %s — ДООПРАЦЮВАННЯ БРАКУ (БУФЕР ЦЕХУ №2)',
            v_category.id, v_classification.order_id, v_classification.task_id,
            v_classification.card_id, coalesce(v_name, 'Деталь'))
        ) RETURNING id INTO v_card_id;

        IF v_classification.nomenclature_id IS NOT NULL THEN
          PERFORM public.vkya_add_route_inventory(
            v_classification.nomenclature_id,
            'semi_shop2',
            p_quantity
          );
        END IF;

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
    $fn$;
  END IF;
END $guard_rework$;

-- Move existing open ('new') VKYA restoration/rework cards out of Shop 2 operator queue into Shop 2 Input Buffer
DO $migrate_open$
DECLARE
  v_rec RECORD;
BEGIN
  FOR v_rec IN
    SELECT id, nomenclature_id, coalesce(quantity, 0) AS qty
    FROM public.work_cards
    WHERE status = 'new'
      AND (
        card_info ILIKE '%[VKYA_RESTORATION]%'
        OR card_info ILIKE '%[REWORK] [ЦЕХ №2]%'
        OR card_info ILIKE '%[RESTORATION] [ЦЕХ №2]%'
      )
  LOOP
    UPDATE public.work_cards
    SET status = 'at-shop2-buffer',
        operation = 'Доопрацювання',
        card_info = regexp_replace(coalesce(card_info, ''), '\[ЦЕХ №2\]', '[VKYA_RETURN]', 'g')
    WHERE id = v_rec.id;

    IF v_rec.nomenclature_id IS NOT NULL AND v_rec.qty > 0 THEN
      PERFORM public.vkya_add_route_inventory(v_rec.nomenclature_id, 'semi_shop2', v_rec.qty);
    END IF;
  END LOOP;
END $migrate_open$;

COMMIT;
