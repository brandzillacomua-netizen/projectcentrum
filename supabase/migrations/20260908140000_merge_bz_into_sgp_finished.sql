-- Migration: Merge BZ inventory into SGP Finished Products (Готова продукція)
-- Date: 2026-09-08

-- 1. Оновлюємо тип усіх залишків БЗ на СГП / загальному складі до 'finished'
UPDATE public.inventory
SET type = 'finished',
    warehouse = 'sgp',
    updated_at = NOW()
WHERE type = 'bz'
  AND (warehouse = 'sgp' OR warehouse IS NULL OR warehouse = 'operational');

-- 2. Оновлюємо функцію резервування деталей reserve_bz_for_naryad,
-- щоб вона перевіряла залишки як для type = 'finished', так і для type = 'bz' / 'part'
CREATE OR REPLACE FUNCTION public.reserve_bz_for_naryad(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_actor_id bigint default null,
  p_actor_name text default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_nom_id uuid;
  v_requested numeric;
  v_available_row public.inventory%rowtype;
  v_wip_row public.inventory%rowtype;
  v_available numeric;
  v_allocated numeric;
  v_reservation public.bz_inventory_reservations%rowtype;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF p_operation_id IS NULL THEN
    RAISE EXCEPTION 'operation_id is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.bz_inventory_reservations
    WHERE operation_id = p_operation_id
  ) THEN
    RETURN jsonb_build_object(
      'operation_id', p_operation_id,
      'allocations', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'reservation_id', id,
          'nomenclature_id', nomenclature_id,
          'requested_qty', requested_qty,
          'allocated_qty', allocated_qty
        ) ORDER BY created_at), '[]'::jsonb)
        FROM public.bz_inventory_reservations
        WHERE operation_id = p_operation_id
      )
    );
  END IF;

  PERFORM set_config('app.bz_enriched_ledger', '1', true);

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(coalesce(p_items, '[]'::jsonb))
  LOOP
    v_nom_id := (v_item->>'nomenclature_id')::uuid;
    v_requested := greatest(coalesce((v_item->>'quantity')::numeric, 0), 0);
    IF v_requested = 0 THEN
      CONTINUE;
    END IF;

    -- Шукаємо вільний залишок серед готової продукції (finished) або історичного bz
    SELECT * INTO v_available_row
    FROM public.inventory
    WHERE nomenclature_id = v_nom_id
      AND (type = 'finished' OR type = 'bz' OR type = 'part')
      AND (pocket_owner IS NULL OR pocket_owner = 'Не вказано')
    ORDER BY CASE WHEN type = 'finished' THEN 0 ELSE 1 END,
             CASE WHEN warehouse = 'sgp' THEN 0 ELSE 1 END,
             created_at, id
    LIMIT 1
    FOR UPDATE;

    v_available := greatest(
      coalesce(v_available_row.total_qty, 0) - coalesce(v_available_row.reserved_qty, 0),
      0
    );
    v_allocated := least(v_requested, v_available);

    INSERT INTO public.bz_inventory_reservations (
      operation_id, order_id, nomenclature_id, requested_qty, allocated_qty,
      actor_id, actor_name
    ) VALUES (
      p_operation_id, p_order_id, v_nom_id, v_requested, v_allocated,
      p_actor_id, p_actor_name
    )
    RETURNING * INTO v_reservation;

    IF v_allocated > 0 THEN
      UPDATE public.inventory
      SET total_qty = coalesce(total_qty, 0) - v_allocated,
          updated_at = now()
      WHERE id = v_available_row.id;

      SELECT * INTO v_wip_row
      FROM public.inventory
      WHERE nomenclature_id = v_nom_id AND type = 'wip_bz'
      ORDER BY created_at, id
      LIMIT 1
      FOR UPDATE;

      IF v_wip_row.id IS NULL THEN
        INSERT INTO public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        VALUES (
          v_nom_id,
          v_available_row.name,
          v_allocated,
          0,
          'wip_bz',
          v_available_row.unit,
          null
        );
      ELSE
        UPDATE public.inventory
        SET total_qty = coalesce(total_qty, 0) + v_allocated,
            updated_at = now()
        WHERE id = v_wip_row.id;
      END IF;
    END IF;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_id', v_reservation.id,
      'nomenclature_id', v_nom_id,
      'requested_qty', v_requested,
      'allocated_qty', v_allocated
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'operation_id', p_operation_id,
    'allocations', v_result
  );
END;
$$;
