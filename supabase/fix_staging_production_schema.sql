-- ═══════════════════════════════════════════════════════════════════════════
-- 🚀 CENTRUM MES: Complete Production Schema for Staging (testbdkulytcya)
-- Adds all missing columns for orders, order_items, tasks, work_cards, material_requests
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer text,
  order_num text,
  nomenclature_id uuid,
  quantity numeric DEFAULT 0,
  deadline timestamptz,
  accessories text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  customer_id uuid
);

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_date text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS official_customer text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS unit text DEFAULT 'шт';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS entered_by text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS responsible_person text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS actual_date timestamptz;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS report text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_num text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_id uuid;

-- 2. ORDER_ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  nomenclature_id uuid,
  quantity numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- 3. TASKS
CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  step text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS operator_name text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS good_qty numeric DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scrap_qty numeric DEFAULT 0;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS finished_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS estimated_time numeric;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS scrap_data jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS engineer_conf boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS warehouse_conf text DEFAULT 'false';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS machine_name text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS director_conf boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS plan_snapshot jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planned_deadline text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS batch_index text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS planned_sets numeric DEFAULT 0;

-- 4. WORK_CARDS
CREATE TABLE IF NOT EXISTS public.work_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS operation text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS machine text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS estimated_time numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS card_info text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS operator_name text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS nomenclature_id uuid;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS quantity numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS is_rework boolean DEFAULT false;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS machine_id text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS manager_name text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS shift_name text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS cutters_used numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS used_in_shop2_qty numeric DEFAULT 0;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS galt_priority numeric DEFAULT 1;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS box_number text;
ALTER TABLE public.work_cards ADD COLUMN IF NOT EXISTS is_box_prepared boolean DEFAULT false;

-- 5. MATERIAL_REQUESTS
CREATE TABLE IF NOT EXISTS public.material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text DEFAULT 'pending',
  quantity numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS order_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS details text;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS inventory_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS nomenclature_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS task_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS card_id uuid;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.material_requests ADD COLUMN IF NOT EXISTS target_warehouse text;

-- 6. RLS & PERMISSIONS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staging_all_access_orders" ON public.orders;
CREATE POLICY "staging_all_access_orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_order_items" ON public.order_items;
CREATE POLICY "staging_all_access_order_items" ON public.order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_tasks" ON public.tasks;
CREATE POLICY "staging_all_access_tasks" ON public.tasks FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_work_cards" ON public.work_cards;
CREATE POLICY "staging_all_access_work_cards" ON public.work_cards FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_material_requests" ON public.material_requests;
CREATE POLICY "staging_all_access_material_requests" ON public.material_requests FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.orders TO anon, authenticated, service_role;
GRANT ALL ON public.order_items TO anon, authenticated, service_role;
GRANT ALL ON public.tasks TO anon, authenticated, service_role;
GRANT ALL ON public.work_cards TO anon, authenticated, service_role;
GRANT ALL ON public.material_requests TO anon, authenticated, service_role;

-- 7. Realtime
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.orders, 
    public.order_items, 
    public.tasks, 
    public.work_cards,
    public.material_requests;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. BZ RESERVATIONS & LEDGER SUBSYSTEM (For Task/Naryad Creation)
-- ═══════════════════════════════════════════════════════════════════════════

-- 8.1 View compatibility for legacy nomenclature queries
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname = 'nomenclatures') THEN
    CREATE VIEW public.nomenclatures AS SELECT * FROM public.nomenclatures_v2;
  END IF;
END $$;

-- 8.2 BZ Reservations Table
CREATE TABLE IF NOT EXISTS public.bz_inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL,
  order_id uuid,
  task_id uuid,
  nomenclature_id uuid NOT NULL,
  requested_qty numeric NOT NULL CHECK (requested_qty >= 0),
  allocated_qty numeric NOT NULL CHECK (allocated_qty >= 0),
  status text NOT NULL DEFAULT 'allocated' CHECK (status IN ('allocated', 'released')),
  actor_id bigint,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz,
  release_reason text,
  UNIQUE (operation_id, nomenclature_id)
);

CREATE INDEX IF NOT EXISTS idx_bz_reservations_task ON public.bz_inventory_reservations(task_id);
CREATE INDEX IF NOT EXISTS idx_bz_reservations_nomenclature_status ON public.bz_inventory_reservations(nomenclature_id, status);
CREATE INDEX IF NOT EXISTS idx_bz_reservations_operation ON public.bz_inventory_reservations(operation_id);

-- 8.3 BZ Inventory Ledger Table
CREATE TABLE IF NOT EXISTS public.bz_inventory_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.bz_inventory_reservations(id) ON DELETE SET NULL,
  nomenclature_id uuid NOT NULL,
  movement_type text NOT NULL,
  from_bucket text,
  to_bucket text,
  quantity numeric NOT NULL CHECK (quantity >= 0),
  from_balance_before numeric,
  from_balance_after numeric,
  to_balance_before numeric,
  to_balance_after numeric,
  order_id uuid,
  task_id uuid,
  actor_id bigint,
  actor_name text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bz_ledger_nomenclature_created ON public.bz_inventory_ledger(nomenclature_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bz_ledger_operation ON public.bz_inventory_ledger(operation_id);
CREATE INDEX IF NOT EXISTS idx_bz_ledger_task ON public.bz_inventory_ledger(task_id);

-- 8.4 Trigger for legacy inventory changes
CREATE OR REPLACE FUNCTION public.audit_legacy_bz_inventory_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_qty numeric := coalesce(old.total_qty, 0);
  v_new_qty numeric := coalesce(new.total_qty, 0);
  v_nom uuid := coalesce(new.nomenclature_id, old.nomenclature_id);
  v_type text := coalesce(new.type, old.type);
BEGIN
  IF current_setting('app.bz_enriched_ledger', true) = '1' THEN
    IF tg_op = 'DELETE' THEN RETURN old; ELSE RETURN new; END IF;
  END IF;

  IF coalesce(old.type, '') NOT IN ('bz', 'wip_bz', 'bz_shop2')
     AND coalesce(new.type, '') NOT IN ('bz', 'wip_bz', 'bz_shop2') THEN
    IF tg_op = 'DELETE' THEN RETURN old; ELSE RETURN new; END IF;
  END IF;

  IF tg_op = 'UPDATE' AND v_old_qty = v_new_qty AND old.type IS NOT DISTINCT FROM new.type THEN
    RETURN new;
  END IF;

  INSERT INTO public.bz_inventory_ledger (
    nomenclature_id, movement_type, from_bucket, to_bucket, quantity,
    from_balance_before, from_balance_after, to_balance_before, to_balance_after,
    metadata
  ) VALUES (
    v_nom,
    CASE tg_op WHEN 'INSERT' THEN 'legacy_insert'
               WHEN 'DELETE' THEN 'legacy_delete'
               ELSE 'legacy_adjustment' END,
    CASE WHEN tg_op <> 'INSERT' THEN old.type END,
    CASE WHEN tg_op <> 'DELETE' THEN new.type END,
    abs(v_new_qty - v_old_qty),
    CASE WHEN tg_op <> 'INSERT' THEN v_old_qty END,
    CASE WHEN tg_op <> 'INSERT' THEN CASE WHEN tg_op = 'DELETE' THEN 0 ELSE v_new_qty END END,
    CASE WHEN tg_op <> 'DELETE' THEN CASE WHEN tg_op = 'INSERT' THEN 0 ELSE v_old_qty END END,
    CASE WHEN tg_op <> 'DELETE' THEN v_new_qty END,
    jsonb_build_object('inventory_id', coalesce(new.id, old.id), 'database_operation', tg_op)
  );

  IF tg_op = 'DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_legacy_bz_inventory_change ON public.inventory;
CREATE TRIGGER trg_audit_legacy_bz_inventory_change
AFTER INSERT OR UPDATE OR DELETE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.audit_legacy_bz_inventory_change();

-- 8.5 Function: reserve_bz_for_naryad
CREATE OR REPLACE FUNCTION public.reserve_bz_for_naryad(
  p_operation_id uuid,
  p_order_id uuid,
  p_items jsonb,
  p_actor_id bigint DEFAULT NULL,
  p_actor_name text DEFAULT NULL
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

    -- Шукаємо вільний залишок серед готової продукції (finished), bz або part
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

    -- Авто-синхронізація nomenclature_id якщо рядок знайдено по назві
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
        )
        RETURNING * INTO v_wip_row;
      ELSE
        UPDATE public.inventory
        SET total_qty = coalesce(total_qty, 0) + v_allocated,
            updated_at = now()
        WHERE id = v_wip_row.id
        RETURNING * INTO v_wip_row;
      END IF;

      INSERT INTO public.bz_inventory_ledger (
        operation_id, reservation_id, nomenclature_id, movement_type,
        from_bucket, to_bucket, quantity,
        from_balance_before, from_balance_after, to_balance_before, to_balance_after,
        order_id, actor_id, actor_name
      ) VALUES (
        p_operation_id, v_reservation.id, v_nom_id, 'allocate_to_naryad',
        'bz', 'wip_bz', v_allocated,
        v_available_row.total_qty, v_available_row.total_qty - v_allocated,
        coalesce(v_wip_row.total_qty, 0) - v_allocated, v_wip_row.total_qty,
        p_order_id, p_actor_id, p_actor_name
      );
    END IF;

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'reservation_id', v_reservation.id,
      'nomenclature_id', v_nom_id,
      'requested_qty', v_requested,
      'allocated_qty', v_allocated,
      'available_before', v_available,
      'available_after', v_available - v_allocated
    ));
  END LOOP;

  RETURN jsonb_build_object(
    'operation_id', p_operation_id,
    'allocations', v_result
  );
END;
$$;

-- 8.6 Function: attach_bz_reservation_to_task
CREATE OR REPLACE FUNCTION public.attach_bz_reservation_to_task(
  p_operation_id uuid,
  p_task_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.bz_inventory_reservations
  SET task_id = p_task_id
  WHERE operation_id = p_operation_id AND task_id IS NULL;

  UPDATE public.bz_inventory_ledger
  SET task_id = p_task_id
  WHERE operation_id = p_operation_id AND task_id IS NULL;
END;
$$;

-- 8.7 Function: release_bz_reservation
CREATE OR REPLACE FUNCTION public.release_bz_reservation(
  p_operation_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.bz_inventory_reservations%rowtype;
  v_bz public.inventory%rowtype;
  v_wip public.inventory%rowtype;
  v_release numeric;
BEGIN
  PERFORM set_config('app.bz_enriched_ledger', '1', true);

  FOR v_res IN
    SELECT * FROM public.bz_inventory_reservations
    WHERE operation_id = p_operation_id AND status = 'allocated'
    ORDER BY created_at, id
    FOR UPDATE
  LOOP
    v_release := v_res.allocated_qty;
    IF v_release > 0 THEN
      SELECT * INTO v_wip
      FROM public.inventory
      WHERE nomenclature_id = v_res.nomenclature_id AND type = 'wip_bz'
      ORDER BY created_at, id LIMIT 1 FOR UPDATE;

      IF v_wip.id IS NOT NULL AND coalesce(v_wip.total_qty, 0) >= v_release THEN
        UPDATE public.inventory
        SET total_qty = total_qty - v_release, updated_at = now()
        WHERE id = v_wip.id;
      END IF;

      SELECT * INTO v_bz
      FROM public.inventory
      WHERE nomenclature_id = v_res.nomenclature_id
        AND (type = 'bz' OR type = 'finished')
        AND (pocket_owner IS NULL OR pocket_owner = 'Не вказано')
      ORDER BY CASE WHEN warehouse = 'operational' THEN 0 ELSE 1 END, created_at, id
      LIMIT 1 FOR UPDATE;

      IF v_bz.id IS NULL THEN
        INSERT INTO public.inventory (
          nomenclature_id, name, total_qty, reserved_qty, type, unit, pocket_owner
        )
        SELECT n.id, n.name, v_release, 0, 'bz', coalesce(n.unit, 'шт'), null
        FROM public.nomenclatures_v2 n WHERE n.id = v_res.nomenclature_id
        RETURNING * INTO v_bz;
      ELSE
        UPDATE public.inventory
        SET total_qty = coalesce(total_qty, 0) + v_release, updated_at = now()
        WHERE id = v_bz.id
        RETURNING * INTO v_bz;
      END IF;

      INSERT INTO public.bz_inventory_ledger (
        operation_id, reservation_id, nomenclature_id, movement_type,
        from_bucket, to_bucket, quantity,
        from_balance_before, from_balance_after, to_balance_before, to_balance_after,
        order_id, task_id, actor_id, actor_name, metadata
      ) VALUES (
        p_operation_id, v_res.id, v_res.nomenclature_id, 'release_naryad_allocation',
        'wip_bz', 'bz', v_release,
        coalesce(v_wip.total_qty, 0) + v_release, coalesce(v_wip.total_qty, 0),
        coalesce(v_bz.total_qty, 0) - v_release, v_bz.total_qty,
        v_res.order_id, v_res.task_id, v_res.actor_id, v_res.actor_name,
        jsonb_build_object('reason', p_reason)
      );
    END IF;

    UPDATE public.bz_inventory_reservations
    SET status = 'released', released_at = now(), release_reason = p_reason
    WHERE id = v_res.id;
  END LOOP;
END;
$$;

-- 8.8 Security, Permissions & Realtime
ALTER TABLE public.bz_inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bz_inventory_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staging_all_access_bz_reservations" ON public.bz_inventory_reservations;
CREATE POLICY "staging_all_access_bz_reservations" ON public.bz_inventory_reservations FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "staging_all_access_bz_ledger" ON public.bz_inventory_ledger;
CREATE POLICY "staging_all_access_bz_ledger" ON public.bz_inventory_ledger FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT ALL ON public.bz_inventory_reservations TO anon, authenticated, service_role;
GRANT ALL ON public.bz_inventory_ledger TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.reserve_bz_for_naryad(uuid, uuid, jsonb, bigint, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.attach_bz_reservation_to_task(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.release_bz_reservation(uuid, text) TO anon, authenticated, service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.bz_inventory_reservations, 
    public.bz_inventory_ledger;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8.9 Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
