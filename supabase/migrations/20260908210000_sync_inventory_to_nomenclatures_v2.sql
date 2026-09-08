-- ═══════════════════════════════════════════════════════════════════════════
-- 🔧 FIX: Синхронізація public.inventory з nomenclatures_v2 + Оновлення reserve_bz_for_naryad
-- ═══════════════════════════════════════════════════════════════════════════
-- Мета:
-- 1. Видалити старий FK constraint inventory_nomenclature_id_fkey, що тримав посилання на V1.
-- 2. Оновити nomenclature_id у таблиці inventory на актуальні канонічні ID з nomenclatures_v2.
-- 3. Додати новий FK constraint на public.nomenclatures_v2.
-- 4. Оновити функцію reserve_bz_for_naryad, щоб вона безпомилково знаходила
--    залишки на СГП як за канонічним ID, так і за назвою номенклатури.
-- ═══════════════════════════════════════════════════════════════════════════

-- КРОК 1: Видаляємо старий FK constraint на public.nomenclatures (V1)
ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS inventory_nomenclature_id_fkey;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.inventory'::regclass
      AND contype = 'f'
      AND confrelid = 'public.nomenclatures'::regclass
  LOOP
    EXECUTE format('ALTER TABLE public.inventory DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END;
$$;

-- КРОК 2: Оновлення nomenclature_id в inventory за назвою з nomenclatures_v2
UPDATE public.inventory i
SET nomenclature_id = v2.id,
    updated_at = NOW()
FROM public.nomenclatures_v2 v2
WHERE LOWER(TRIM(i.name)) = LOWER(TRIM(v2.name))
  AND (i.nomenclature_id IS NULL OR i.nomenclature_id != v2.id);

-- КРОК 3: Додаткова синхронізація через стару таблицю nomenclatures (V1)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'nomenclatures') THEN
    UPDATE public.inventory i
    SET nomenclature_id = v2.id,
        updated_at = NOW()
    FROM public.nomenclatures v1
    JOIN public.nomenclatures_v2 v2 ON LOWER(TRIM(v1.name)) = LOWER(TRIM(v2.name))
    WHERE i.nomenclature_id = v1.id
      AND (i.nomenclature_id != v2.id);
  END IF;
END $$;

-- КРОК 4: Додаємо новий FK що посилається на nomenclatures_v2
DO $$
BEGIN
  ALTER TABLE public.inventory
    ADD CONSTRAINT inventory_nomenclature_id_fkey
      FOREIGN KEY (nomenclature_id)
      REFERENCES public.nomenclatures_v2(id)
      ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Constraint inventory_nomenclature_id_fkey could not be enforced strictly: %', SQLERRM;
END;
$$;

-- КРОК 5: Індекс для надшвидкого пошуку залишків за nomenclature_id
CREATE INDEX IF NOT EXISTS idx_inventory_nomenclature_id ON public.inventory(nomenclature_id);
CREATE INDEX IF NOT EXISTS idx_inventory_name_lower ON public.inventory(LOWER(TRIM(name)));

-- КРОК 6: Оновлення функції reserve_bz_for_naryad з розумним пошуком та авто-синхронізацією ID
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

    -- Шукаємо вільний залишок серед готової продукції (finished) або історичного bz:
    -- 1) Пряме співпадіння за nomenclature_id
    -- 2) Або за збігом назви з nomenclatures_v2 (якщо nomenclature_id ще старий)
    SELECT * INTO v_available_row
    FROM public.inventory i
    WHERE (
        i.nomenclature_id = v_nom_id
        OR EXISTS (
          SELECT 1 FROM public.nomenclatures_v2 v2
          WHERE v2.id = v_nom_id AND LOWER(TRIM(v2.name)) = LOWER(TRIM(i.name))
        )
      )
      AND (i.type = 'finished' OR i.type = 'bz' OR i.type = 'part' OR i.warehouse = 'sgp')
      AND (i.pocket_owner IS NULL OR i.pocket_owner = 'Не вказано')
    ORDER BY CASE WHEN i.nomenclature_id = v_nom_id THEN 0 ELSE 1 END,
             CASE WHEN i.type = 'finished' THEN 0 ELSE 1 END,
             CASE WHEN i.warehouse = 'sgp' THEN 0 ELSE 1 END,
             i.created_at, i.id
    LIMIT 1
    FOR UPDATE;

    -- Якщо знайдено рядок зі старим nomenclature_id, автоматично оновлюємо його на v_nom_id
    IF v_available_row.id IS NOT NULL AND (v_available_row.nomenclature_id IS NULL OR v_available_row.nomenclature_id != v_nom_id) THEN
      UPDATE public.inventory
      SET nomenclature_id = v_nom_id,
          updated_at = NOW()
      WHERE id = v_available_row.id;
      v_available_row.nomenclature_id := v_nom_id;
    END IF;

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

-- КРОК 7: ПІДТВЕРДЖЕННЯ — перевірка залишків по деталях Київ К-ІП9/10/31/36/37...
SELECT
  i.id,
  i.name,
  i.nomenclature_id,
  v2.code AS v2_code,
  i.total_qty,
  i.reserved_qty,
  i.type,
  i.warehouse
FROM public.inventory i
LEFT JOIN public.nomenclatures_v2 v2 ON v2.id = i.nomenclature_id
WHERE i.name ILIKE '%Київ К-ІП9/10/31/36/37%'
ORDER BY i.name;
