-- rollout-contract: v1
-- risk: high
-- transaction: transactional
-- preflight: supabase/diagnostics/20261003190000_factory_accounting_guards_preflight.sql
-- postcondition: supabase/diagnostics/20261003190000_factory_accounting_guards_postcondition.sql
-- rollback: supabase/rollbacks/20261003190000_factory_accounting_guards_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
BEGIN;
CREATE SCHEMA IF NOT EXISTS mes_private;
CREATE TABLE IF NOT EXISTS mes_private.accounting_function_backup (
  release text NOT NULL, signature text NOT NULL, definition text NOT NULL, PRIMARY KEY(release,signature)
);
CREATE TABLE IF NOT EXISTS mes_private.accounting_receipts (
  operation text NOT NULL, operation_key text NOT NULL, payload jsonb NOT NULL, result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(operation,operation_key)
);
REVOKE ALL ON mes_private.accounting_function_backup, mes_private.accounting_receipts FROM PUBLIC, anon, authenticated;
DO $backup$
DECLARE sig text;
BEGIN
  FOREACH sig IN ARRAY ARRAY['public.rpc_deduct_inventory_atomic(uuid,numeric,numeric)',
'public.rpc_reserve_material_atomic(uuid,numeric,text,text)',
'public.rpc_increment_inventory_stock(uuid,numeric,text,text,text,text)',
'public.rpc_qc_scrap_atomic(uuid,numeric,jsonb,text)',
'public.rpc_submit_sorting_complete_atomic(uuid,numeric,numeric,numeric,text,text)',
'public.rpc_handover_to_sgp_atomic(uuid)',
'public.rpc_handover_task_to_shop2_atomic(uuid)',
'public.vkya_add_route_inventory(uuid,text,integer)',
'public.return_legacy_restoration_to_bz(uuid,text)',
'public.return_vkya_restoration_to_route(uuid,text)'] LOOP
    IF to_regprocedure(sig) IS NULL THEN RAISE EXCEPTION 'Missing required deployed function %',sig; END IF;
    INSERT INTO mes_private.accounting_function_backup SELECT '20261003190000_factory_accounting_guards',sig,pg_get_functiondef(to_regprocedure(sig)) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$backup$;
CREATE OR REPLACE FUNCTION mes_private.consume_factory_stock(p_nom uuid,p_types text[],p_qty numeric,p_shop1_semi boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $consume$
DECLARE r record; remaining numeric:=p_qty; take_qty numeric;
BEGIN
 IF p_qty IS NULL OR p_qty<0 OR p_qty::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid stock movement'; END IF;
 FOR r IN SELECT * FROM public.inventory WHERE nomenclature_id=p_nom AND type=ANY(p_types) AND pocket_owner IS NULL
 AND (NOT p_shop1_semi OR warehouse='production' OR warehouse IS NULL)
 ORDER BY array_position(p_types,type),id FOR UPDATE LOOP
   take_qty:=least(coalesce(r.total_qty,0),remaining);
   IF take_qty>0 THEN UPDATE public.inventory SET total_qty=total_qty-take_qty,updated_at=now() WHERE id=r.id; remaining:=remaining-take_qty; END IF;
   EXIT WHEN remaining=0;
 END LOOP;
 IF remaining>0 THEN RAISE EXCEPTION 'Insufficient stock: missing %',remaining; END IF;
END;
$consume$;
REVOKE ALL ON FUNCTION mes_private.consume_factory_stock(uuid,text[],numeric,boolean) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION rpc_deduct_inventory_atomic(
  p_inventory_id UUID,
  p_deduct_total NUMERIC DEFAULT 0,
  p_release_reserved NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_inv RECORD;
  v_new_total NUMERIC;
  v_new_reserved NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;

  IF p_deduct_total IS NULL OR p_release_reserved IS NULL OR
     p_deduct_total::text IN ('NaN','Infinity','-Infinity') OR p_release_reserved::text IN ('NaN','Infinity','-Infinity') OR
     p_deduct_total < 0 OR p_release_reserved < 0 THEN
    RAISE EXCEPTION 'Invalid deduction quantity' USING ERRCODE = '22023';
  END IF;
  IF p_inventory_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'inventory_id is required');
  END IF;

  SELECT * INTO v_inv
  FROM public.inventory
  WHERE id = p_inventory_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Inventory row not found');
  END IF;

  IF p_deduct_total > coalesce(v_inv.total_qty,0) THEN
    RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_inv.total_qty, p_deduct_total USING ERRCODE = 'P0001';
  END IF;
  v_new_total := GREATEST(0, COALESCE(v_inv.total_qty, 0) - COALESCE(p_deduct_total, 0));
  v_new_reserved := GREATEST(0, COALESCE(v_inv.reserved_qty, 0) - COALESCE(p_release_reserved, 0));

  UPDATE public.inventory
  SET total_qty = v_new_total,
      reserved_qty = v_new_reserved,
      updated_at = NOW()
  WHERE id = p_inventory_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', p_inventory_id,
    'prev_total', v_inv.total_qty,
    'new_total', v_new_total,
    'prev_reserved', v_inv.reserved_qty,
    'new_reserved', v_new_reserved
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_reserve_material_atomic(
  p_inventory_id uuid,
  p_qty numeric,
  p_action text, -- 'reserve' | 'release' | 'deduct'
  p_idempotency_key text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_inv record;
  v_payload jsonb := jsonb_build_object('inventory_id',p_inventory_id,'qty',p_qty,'action',p_action);
  v_receipt record;
  v_result jsonb;
  v_new_reserved numeric;
  v_new_total numeric;
BEGIN
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;

  IF p_qty IS NULL OR p_qty::text IN ('NaN','Infinity','-Infinity') THEN
    RAISE EXCEPTION 'Invalid quantity' USING ERRCODE = '22023';
  END IF;
  IF nullif(p_idempotency_key,'') IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('reserve:' || p_idempotency_key,0));
    SELECT * INTO v_receipt FROM mes_private.accounting_receipts WHERE operation='reserve' AND operation_key=p_idempotency_key;
    IF FOUND THEN
      IF v_receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Idempotency key reused with different input'; END IF;
      RETURN v_receipt.result;
    END IF;
  END IF;
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'Quantity must be positive' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Row Lock
  SELECT * INTO v_inv FROM public.inventory WHERE id = p_inventory_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % not found', p_inventory_id USING ERRCODE = 'P0002';
  END IF;

  IF p_action = 'reserve' THEN
    v_new_reserved := coalesce(v_inv.reserved_qty,0) + p_qty;
    IF v_new_reserved > v_inv.total_qty THEN
      RAISE EXCEPTION 'Insufficient stock to reserve. Total: %, Current Reserved: %, Requested: %', 
        v_inv.total_qty, v_inv.reserved_qty, p_qty USING ERRCODE = 'P0003';
    END IF;

    UPDATE public.inventory
    SET reserved_qty = v_new_reserved,
        updated_at = now()
    WHERE id = p_inventory_id;

  ELSIF p_action = 'release' THEN
    v_new_reserved := GREATEST(0, v_inv.reserved_qty - p_qty);

    UPDATE public.inventory
    SET reserved_qty = v_new_reserved,
        updated_at = now()
    WHERE id = p_inventory_id;

  ELSIF p_action = 'deduct' THEN
    IF p_qty > coalesce(v_inv.total_qty,0) THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
    v_new_total := GREATEST(0, v_inv.total_qty - p_qty);
    v_new_reserved := GREATEST(0, v_inv.reserved_qty - p_qty);

    UPDATE public.inventory
    SET total_qty = v_new_total,
        reserved_qty = v_new_reserved,
        updated_at = now()
    WHERE id = p_inventory_id;

  ELSE
    RAISE EXCEPTION 'Invalid action: %', p_action USING ERRCODE = 'P0001';
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'inventory_id', p_inventory_id,
    'action', p_action,
    'total_qty', COALESCE(v_new_total, v_inv.total_qty),
    'reserved_qty', v_new_reserved
  );
  IF nullif(p_idempotency_key,'') IS NOT NULL THEN
    INSERT INTO mes_private.accounting_receipts(operation,operation_key,payload,result) VALUES ('reserve',p_idempotency_key,v_payload,v_result);
  END IF;
  RETURN v_result;
END;
$body$;

create or replace function public.rpc_increment_inventory_stock(
  p_nomenclature_id uuid,
  p_qty numeric,
  p_type text default 'scrap_ready',
  p_item_name text default 'Деталь',
  p_unit text default 'шт',
  p_warehouse text default 'operational'
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, public
as $inventory_increment$
declare
  v_inv_id uuid;
  v_old_qty numeric := 0;
  v_new_qty numeric := 0;
  v_nom_name text;
  v_nom_unit text;
  v_can_relink boolean := false;
  v_safe_warehouse text;
begin

  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;
  if p_nomenclature_id is null or p_qty is null or p_qty::text in ('NaN','Infinity','-Infinity') or p_qty <= 0 then
    return jsonb_build_object(
      'success', false,
      'error', 'Invalid nomenclature_id or non-positive quantity'
    );
  end if;

  v_safe_warehouse := coalesce(nullif(btrim(p_warehouse), ''), 'operational');

  select n.name, n.unit, true
    into v_nom_name, v_nom_unit, v_can_relink
    from public.nomenclatures_v2 n
   where n.id = p_nomenclature_id;

  if not found then
    select n.name, n.unit
      into v_nom_name, v_nom_unit
      from public.nomenclatures n
     where n.id = p_nomenclature_id;
  end if;

  v_nom_name := coalesce(nullif(btrim(v_nom_name), ''), nullif(btrim(p_item_name), ''), 'Деталь');
  v_nom_unit := coalesce(nullif(btrim(v_nom_unit), ''), nullif(btrim(p_unit), ''), 'шт');

  perform pg_advisory_xact_lock(hashtextextended(
    lower(v_nom_name) || '|' || coalesce(p_type, '') || '|' || v_safe_warehouse || '|', 0
  ));

  select i.id, coalesce(i.total_qty, 0)
    into v_inv_id, v_old_qty
    from public.inventory i
   where i.type is not distinct from p_type
     and i.warehouse is not distinct from v_safe_warehouse
     and i.pocket_owner is null
     and (
       i.nomenclature_id = p_nomenclature_id
       or (i.nomenclature_id is null and lower(btrim(i.name)) = lower(v_nom_name))
     )
   order by case when i.nomenclature_id = p_nomenclature_id then 0 else 1 end,
            i.created_at,
            i.id
   limit 1
   for update;

  if found then
    v_new_qty := v_old_qty + p_qty;
    update public.inventory
       set total_qty = v_new_qty,
           nomenclature_id = case when v_can_relink then p_nomenclature_id else nomenclature_id end,
           name = v_nom_name,
           unit = v_nom_unit,
           updated_at = clock_timestamp()
     where id = v_inv_id;

    return jsonb_build_object(
      'success', true,
      'id', v_inv_id,
      'prev_qty', v_old_qty,
      'new_qty', v_new_qty,
      'action', 'updated'
    );
  end if;

  insert into public.inventory (
    nomenclature_id, name, unit, total_qty, type, warehouse, pocket_owner, updated_at
  ) values (
    p_nomenclature_id, v_nom_name, v_nom_unit, p_qty, p_type, v_safe_warehouse, null, clock_timestamp()
  )
  on conflict on constraint inventory_name_type_warehouse_owner_unique
  do update set
    total_qty = coalesce(public.inventory.total_qty, 0) + excluded.total_qty,
    nomenclature_id = case when v_can_relink then excluded.nomenclature_id else public.inventory.nomenclature_id end,
    unit = excluded.unit,
    updated_at = clock_timestamp()
  where public.inventory.nomenclature_id is null or public.inventory.nomenclature_id = excluded.nomenclature_id
  returning id, total_qty into v_inv_id, v_new_qty;
  if not found then raise exception 'Inventory name belongs to another nomenclature; reconcile identity before posting'; end if;

  return jsonb_build_object(
    'success', true,
    'id', v_inv_id,
    'prev_qty', v_new_qty - p_qty,
    'new_qty', v_new_qty,
    'action', case when v_new_qty = p_qty then 'inserted' else 'updated_after_conflict' end
  );
end;
$inventory_increment$;

CREATE OR REPLACE FUNCTION rpc_qc_scrap_atomic(
  p_card_id UUID,
  p_scrap_qty NUMERIC,
  p_history_data JSONB,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_rpc_version CONSTANT TEXT := '2026-09-06.qc_scrap_v1';
  v_current_card RECORD;
  v_new_qty NUMERIC;
  v_target_status TEXT;
  v_inventory_id UUID;
  v_existing_inv_qty NUMERIC;
  v_final_card_info TEXT;
  v_receipt record;
  v_payload jsonb := jsonb_build_object('card_id',p_card_id,'qty',p_scrap_qty,'history',p_history_data);
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;

  IF p_scrap_qty IS NULL OR p_scrap_qty::text IN ('NaN','Infinity','-Infinity') OR p_scrap_qty <= 0 THEN
    RAISE EXCEPTION 'Invalid scrap quantity' USING ERRCODE = '22023';
  END IF;
  IF nullif(p_idempotency_key,'') IS NULL THEN RAISE EXCEPTION 'Scrap operation requires an idempotency key'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('qc:' || p_idempotency_key,0));
  SELECT * INTO v_receipt FROM mes_private.accounting_receipts WHERE operation='qc' AND operation_key=p_idempotency_key;
  IF FOUND THEN
    IF v_receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Idempotency key reused with different input'; END IF;
    RETURN v_receipt.result || jsonb_build_object('already_processed',true,'reason','idempotent_replay');
  END IF;
  -- Транзакційне блокування рядка картки
  SELECT * INTO v_current_card
  FROM work_cards
  WHERE id = p_card_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Card not found',
      'rpc_version', v_rpc_version
    );
  END IF;

  IF p_scrap_qty <= 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Scrap quantity must be greater than 0',
      'rpc_version', v_rpc_version
    );
  END IF;

  IF p_scrap_qty > coalesce(v_current_card.quantity,0) THEN RAISE EXCEPTION 'Scrap exceeds card quantity'; END IF;
  v_new_qty := GREATEST(0, COALESCE(v_current_card.quantity, 0) - p_scrap_qty);
  v_target_status := CASE WHEN v_new_qty <= 0 THEN 'completed' ELSE v_current_card.status END;

  -- Оновлення кількості картки
  UPDATE work_cards
  SET
    quantity = v_new_qty,
    status = v_target_status,
    updated_at = NOW()
  WHERE id = p_card_id;

  -- Фіксація запису в історію
  IF p_history_data IS NOT NULL THEN
    v_final_card_info := COALESCE(p_history_data->>'card_info', '');
    IF p_idempotency_key IS NOT NULL AND v_final_card_info NOT LIKE '%[IDEMPOTENCY_KEY:%' THEN
      v_final_card_info := TRIM(v_final_card_info || ' [IDEMPOTENCY_KEY:' || p_idempotency_key || ']');
    END IF;

    INSERT INTO work_card_history (
      card_id,
      task_id,
      nomenclature_id,
      stage_name,
      operator_name,
      card_info,
      qty_at_start,
      qty_completed,
      scrap_qty,
      started_at,
      completed_at,
      shift_name,
      manager_name,
      machine_name
    ) VALUES (
      p_card_id,
      COALESCE((p_history_data->>'task_id')::UUID, v_current_card.task_id),
      COALESCE((p_history_data->>'nomenclature_id')::UUID, v_current_card.nomenclature_id),
      COALESCE(p_history_data->>'stage_name', v_current_card.operation),
      COALESCE(p_history_data->>'operator_name', 'Не вказано'),
      v_final_card_info,
      COALESCE(v_current_card.quantity, 0),
      0,
      p_scrap_qty,
      (p_history_data->>'started_at')::TIMESTAMPTZ,
      COALESCE((p_history_data->>'completed_at')::TIMESTAMPTZ, NOW()),
      p_history_data->>'shift_name',
      p_history_data->>'manager_name',
      p_history_data->>'machine_name'
    );
  END IF;

  -- Зарахування браку на оперативний склад scrap_ready
  IF v_current_card.nomenclature_id IS NOT NULL THEN
    PERFORM rpc_increment_inventory_stock(
      v_current_card.nomenclature_id,
      p_scrap_qty,
      'scrap_ready',
      'Брак деталі',
      'шт'
    );
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'prev_qty', v_current_card.quantity,
    'new_qty', v_new_qty,
    'status', v_target_status,
    'scrap_logged', p_scrap_qty,
    'rpc_version', v_rpc_version
  );
  INSERT INTO mes_private.accounting_receipts(operation,operation_key,payload,result) VALUES ('qc',p_idempotency_key,v_payload,v_result);
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_submit_sorting_complete_atomic(
  p_card_id uuid,
  p_good_qty numeric,
  p_scrap_qty numeric,
  p_rework_qty numeric,
  p_operator_name text,
  p_shift_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_card record;
  v_nom_id uuid;
  v_nom_name text;
  v_unit text;
  v_total_good numeric;
  v_card_bz numeric;
  v_card_need numeric;
  v_actual_need numeric;
  v_actual_bz numeric;
  v_rem numeric;
  v_take numeric;
  v_s1_inv record;
  v_s2_inv record;
  v_scrap_inv record;
  v_shop2_task_id uuid;
  v_shop2_task record;
  v_arrivals jsonb;
  v_receipt record;
  v_payload jsonb := jsonb_build_object('good',p_good_qty,'scrap',p_scrap_qty,'rework',p_rework_qty);
  v_result jsonb;
  v_match_idx integer;
BEGIN
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;

  IF p_good_qty IS NULL OR p_scrap_qty IS NULL OR p_rework_qty IS NULL OR
    p_good_qty::text IN ('NaN','Infinity','-Infinity') OR p_scrap_qty::text IN ('NaN','Infinity','-Infinity') OR
    p_rework_qty::text IN ('NaN','Infinity','-Infinity') OR least(p_good_qty,p_scrap_qty,p_rework_qty)<0 THEN
    RAISE EXCEPTION 'Invalid sorting quantities';
  END IF;
  -- Lock card
  SELECT * INTO v_card FROM public.work_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % not found', p_card_id USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_receipt FROM mes_private.accounting_receipts WHERE operation='sorting' AND operation_key=p_card_id::text;
  IF FOUND THEN
    IF v_receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Sorting already completed with different quantities'; END IF;
    RETURN v_receipt.result;
  END IF;
  IF v_card.status IN ('completed','at-shop2-buffer') THEN RAISE EXCEPTION 'Card already sorted; refresh its state'; END IF;
  IF p_good_qty+p_scrap_qty+p_rework_qty <> coalesce(v_card.quantity,0) THEN RAISE EXCEPTION 'Sorting quantities do not balance'; END IF;
  v_nom_id := v_card.nomenclature_id;
  SELECT name, unit INTO v_nom_name, v_unit FROM public.nomenclatures_v2 WHERE id = v_nom_id LIMIT 1;
  IF v_nom_name IS NULL THEN v_nom_name := 'Деталь'; END IF;
  IF v_unit IS NULL THEN v_unit := 'шт'; END IF;

  v_total_good := GREATEST(0, p_good_qty);

  -- Calculate need vs bz breakdown
  v_card_bz := COALESCE(v_card.buffer_qty, 0);
  IF v_card_bz <= 0 THEN
    v_card_bz := COALESCE((substring(v_card.card_info from '\[BZ:([0-9]+)\]'))::numeric, 0);
  END IF;

  v_card_need := COALESCE((substring(v_card.card_info from '\[REQ:([0-9]+)\]'))::numeric, 0);
  IF v_card_need <= 0 THEN
    v_card_need := COALESCE((substring(v_card.card_info from '\[NEED:([0-9]+)\]'))::numeric, 0);
  END IF;
  IF v_card_need <= 0 THEN
    v_card_need := GREATEST(0, v_card.quantity - v_card_bz);
  END IF;

  v_actual_need := LEAST(v_total_good, v_card_need);
  v_actual_bz := GREATEST(0, v_total_good - v_actual_need);

  PERFORM mes_private.consume_factory_stock(v_nom_id,ARRAY['semi'],v_actual_need,true);
  PERFORM mes_private.consume_factory_stock(v_nom_id,ARRAY['wip_bz','bz'],v_actual_bz,false);
  -- 3. Increase Shop 2 semi_shop2 inventory
  IF v_actual_need > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'semi_shop2' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + v_actual_need WHERE id = v_s2_inv.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
      VALUES (v_nom_id, v_nom_name, v_actual_need, 'semi_shop2', v_unit, 0, 'production');
    END IF;
  END IF;

  -- 4. Increase Shop 2 bz_shop2 inventory
  IF v_actual_bz > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'bz_shop2' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + v_actual_bz WHERE id = v_s2_inv.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
      VALUES (v_nom_id, v_nom_name, v_actual_bz, 'bz_shop2', v_unit, 0, 'production');
    END IF;
  END IF;

  -- 5. Increase scrap_ready if scrap occurred
  IF p_scrap_qty > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_scrap_inv FROM public.inventory WHERE nomenclature_id = v_nom_id AND type = 'scrap_ready' LIMIT 1 FOR UPDATE;
    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + p_scrap_qty WHERE id = v_scrap_inv.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
      VALUES (v_nom_id, v_nom_name, p_scrap_qty, 'scrap_ready', v_unit, 0, 'production');
    END IF;
  END IF;

  -- 6. Update work card to at-shop2-buffer
  UPDATE public.work_cards
  SET status = 'at-shop2-buffer',
      operation = 'Сортування',
      quantity = v_total_good + GREATEST(0, p_rework_qty),
      used_in_shop2_qty = GREATEST(0, p_rework_qty),
      completed_at = now()
  WHERE id = p_card_id;

  -- 7. Find Shop 2 task and update task arrivals
  IF v_card.order_id IS NOT NULL THEN
    SELECT id INTO v_shop2_task_id FROM public.tasks 
    WHERE order_id = v_card.order_id AND step ILIKE '%ЦЕХ №2%' AND status <> 'completed' 
    LIMIT 1;
  END IF;

  -- 8. Create rework card if rework quantity > 0
  IF p_rework_qty > 0 THEN
    INSERT INTO public.work_cards (task_id, order_id, nomenclature_id, operation, quantity, status, card_info)
    VALUES (
      COALESCE(v_shop2_task_id, v_card.task_id),
      v_card.order_id,
      v_nom_id,
      'Доопрацювання',
      p_rework_qty,
      'new',
      '[ЦЕХ №2] Автоматично з Сортування'
    );
  END IF;

  -- 9. Insert work card history entry
  INSERT INTO public.work_card_history (
    card_id, nomenclature_id, stage_name, operator_name, 
    qty_at_start, qty_completed, scrap_qty, started_at, completed_at, shift_name
  )
  VALUES (
    p_card_id, v_nom_id, 'Сортування', COALESCE(p_operator_name, 'Сортування'),
    v_card.quantity, v_total_good, GREATEST(0, p_scrap_qty), v_card.started_at, now(), p_shift_name
  );

  v_result := jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'good_qty', v_total_good,
    'scrap_qty', GREATEST(0, p_scrap_qty),
    'rework_qty', GREATEST(0, p_rework_qty)
  );
  INSERT INTO mes_private.accounting_receipts(operation,operation_key,payload,result) VALUES ('sorting',p_card_id::text,v_payload,v_result);
  RETURN v_result;
END;
$body$;

CREATE OR REPLACE FUNCTION public.rpc_handover_to_sgp_atomic(
  p_card_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_card record;
  v_total_qty numeric;
  v_nom_id uuid;
  v_nom_name text;
  v_unit text;
  v_finished_qty numeric;
  v_bz_qty numeric;
  v_inv_sgp record;
  v_rem_deduct numeric;
  v_take numeric;
  v_s2_row record;
BEGIN
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;

  -- Lock work card
  SELECT * INTO v_card FROM public.work_cards WHERE id = p_card_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Card % not found', p_card_id USING ERRCODE = 'P0002';
  END IF;

  -- Idempotent check
  IF v_card.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  v_total_qty := COALESCE(v_card.quantity, 0);
  v_nom_id := v_card.nomenclature_id;
  
  SELECT name, unit INTO v_nom_name, v_unit FROM public.nomenclatures_v2 WHERE id = v_nom_id LIMIT 1;
  IF v_nom_name IS NULL THEN v_nom_name := 'Готова продукція'; END IF;
  IF v_unit IS NULL THEN v_unit := 'шт'; END IF;

  IF v_total_qty <= 0 OR v_total_qty::text IN ('NaN','Infinity','-Infinity') OR v_nom_id IS NULL THEN RAISE EXCEPTION 'Invalid card quantity or nomenclature'; END IF;
  v_finished_qty := v_total_qty;
  v_bz_qty := 0;

  -- 1. Deduct total_qty from Shop 2 buffers (semi_shop2, bz_shop2)
  v_rem_deduct := v_total_qty;
  IF v_rem_deduct > 0 AND v_nom_id IS NOT NULL THEN
    FOR v_s2_row IN 
      SELECT * FROM public.inventory 
      WHERE nomenclature_id = v_nom_id AND type IN ('semi_shop2', 'bz_shop2')
      ORDER BY CASE WHEN type = 'semi_shop2' THEN 1 ELSE 2 END ASC
      FOR UPDATE
    LOOP
      v_take := LEAST(v_s2_row.total_qty, v_rem_deduct);
      IF v_take > 0 THEN
        UPDATE public.inventory SET total_qty = GREATEST(0, total_qty - v_take) WHERE id = v_s2_row.id;
        v_rem_deduct := v_rem_deduct - v_take;
      END IF;
      EXIT WHEN v_rem_deduct <= 0;
    END LOOP;
  END IF;

  IF v_rem_deduct > 0 THEN RAISE EXCEPTION 'Insufficient Shop 2 stock: missing %',v_rem_deduct; END IF;
  -- 2. Add finishedQty to SGP finished inventory
  IF v_finished_qty > 0 AND v_nom_id IS NOT NULL THEN
    SELECT * INTO v_inv_sgp FROM public.inventory 
    WHERE nomenclature_id = v_nom_id AND type = 'finished' AND warehouse = 'sgp' 
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.inventory SET total_qty = total_qty + v_finished_qty, updated_at = now() WHERE id = v_inv_sgp.id;
    ELSE
      INSERT INTO public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, updated_at)
      VALUES (v_nom_id, v_nom_name, v_unit, v_finished_qty, 0, 'finished', 'sgp', now());
    END IF;
  END IF;

  -- 3. Update work card to completed status
  UPDATE public.work_cards 
  SET status = 'completed',
      operation = 'Пакування/СГП',
      completed_at = now(),
      card_info = ('[ЦЕХ №2] [NEED:' || v_finished_qty || '] [BZ:' || v_bz_qty || '] ' || COALESCE(card_info, ''))
  WHERE id = p_card_id;

  -- 4. Record work card history
  INSERT INTO public.work_card_history (card_id, nomenclature_id, stage_name, operator_name, qty_at_start, qty_completed, scrap_qty, completed_at)
  VALUES (p_card_id, v_nom_id, 'Пакування/СГП', 'Система (ТЕРМІНАЛ)', v_total_qty, v_total_qty, 0, now());

  RETURN jsonb_build_object(
    'success', true,
    'card_id', p_card_id,
    'finished_qty', v_finished_qty
  );
END;
$body$;

CREATE OR REPLACE FUNCTION public.rpc_handover_task_to_shop2_atomic(
  p_task_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $body$
DECLARE
  v_task record;
  v_shop2_task record;
  v_arrivals jsonb := '[]'::jsonb;
  v_nom_id text;
  v_nom_name text;
  v_unit text;
  v_produced_s1 numeric;
  v_stock_start numeric;
  v_total_move numeric;
  v_snap_need numeric;
  v_move_semi numeric;
  v_move_bz numeric;
  v_dec_semi numeric;
  v_dec_wip numeric;
  v_take numeric;
  v_rem numeric;
  v_s1_inv record;
  v_s2_inv record;
  v_doc_id uuid;
  v_doc_num text;
BEGIN
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;

  -- Lock task
  SELECT * INTO v_task FROM public.tasks WHERE id = p_task_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task % not found', p_task_id USING ERRCODE = 'P0002';
  END IF;

  -- If task is already completed, return idempotent success
  IF v_task.status = 'completed' THEN
    RETURN jsonb_build_object('success', true, 'already_completed', true);
  END IF;

  -- Mark task completed
  UPDATE public.tasks 
  SET status = 'completed', completed_at = now() 
  WHERE id = p_task_id;

  v_doc_num := 'T-S1-S2-' || right(extract(epoch from now())::text, 6);

  -- Process snapshot parts if present
  IF v_task.plan_snapshot IS NOT NULL THEN
    FOR v_nom_id IN 
      SELECT key FROM jsonb_object_keys(v_task.plan_snapshot) AS key 
      WHERE key NOT IN ('_metadata', 'materialSummary')
      ORDER BY key ASC
    LOOP
      SELECT name, unit INTO v_nom_name, v_unit FROM public.nomenclatures_v2 WHERE id::text = v_nom_id LIMIT 1;
      IF v_nom_name IS NULL THEN v_nom_name := 'Деталь'; END IF;
      IF v_unit IS NULL THEN v_unit := 'шт'; END IF;

      -- Calculate quantity produced in Shop 1 vs Stock
      SELECT COALESCE(SUM(quantity), 0) INTO v_produced_s1 
      FROM public.work_cards 
      WHERE task_id = p_task_id AND status = 'completed' AND nomenclature_id::text = v_nom_id AND (operation IS NULL OR operation <> 'Склад БЗ');

      SELECT COALESCE(SUM(quantity), 0) INTO v_stock_start 
      FROM public.work_cards 
      WHERE task_id = p_task_id AND status = 'completed' AND nomenclature_id::text = v_nom_id AND operation = 'Склад БЗ';

      v_total_move := v_produced_s1 + v_stock_start;

      IF v_total_move > 0 THEN
        v_snap_need := COALESCE((v_task.plan_snapshot->v_nom_id->>'need')::numeric, 0);
        v_move_semi := LEAST(v_total_move, v_snap_need);
        v_move_bz := GREATEST(0, v_total_move - v_move_semi);

        v_arrivals := v_arrivals || jsonb_build_object(
          'id', v_nom_id,
          'name', v_nom_name,
          'semi', v_move_semi,
          'bz', v_move_bz
        );

        -- Decrease Shop 1 stock
        IF v_produced_s1 > 0 THEN
          v_dec_semi := LEAST(v_produced_s1, v_snap_need);
          v_dec_wip := GREATEST(0, v_produced_s1 - v_dec_semi);

          PERFORM mes_private.consume_factory_stock(v_nom_id::uuid,ARRAY['semi'],v_dec_semi,true);
          PERFORM mes_private.consume_factory_stock(v_nom_id::uuid,ARRAY['wip_bz','bz'],v_dec_wip,false);
        END IF;

        -- Increase Shop 2 stock (semi_shop2)
        IF v_move_semi > 0 THEN
          SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id::text = v_nom_id AND type = 'semi_shop2' LIMIT 1 FOR UPDATE;
          IF FOUND THEN
            UPDATE public.inventory SET total_qty = total_qty + v_move_semi WHERE id = v_s2_inv.id;
          ELSE
            INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
            VALUES (v_nom_id::uuid, v_nom_name, v_move_semi, 'semi_shop2', v_unit, 0, 'production');
          END IF;
        END IF;

        -- Increase Shop 2 stock (bz_shop2)
        IF v_move_bz > 0 THEN
          SELECT * INTO v_s2_inv FROM public.inventory WHERE nomenclature_id::text = v_nom_id AND type = 'bz_shop2' LIMIT 1 FOR UPDATE;
          IF FOUND THEN
            UPDATE public.inventory SET total_qty = total_qty + v_move_bz WHERE id = v_s2_inv.id;
          ELSE
            INSERT INTO public.inventory (nomenclature_id, name, total_qty, type, unit, reserved_qty, warehouse)
            VALUES (v_nom_id::uuid, v_nom_name, v_move_bz, 'bz_shop2', v_unit, 0, 'production');
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Create internal transfer reception document
  INSERT INTO public.reception_docs (doc_num, type, status, order_id, details)
  VALUES (v_doc_num, 'internal_transfer', 'completed', v_task.order_id, v_arrivals::text)
  RETURNING id INTO v_doc_id;

  -- Find and activate existing Shop 2 task if exists
  IF v_task.order_id IS NOT NULL THEN
    SELECT * INTO v_shop2_task FROM public.tasks 
    WHERE order_id = v_task.order_id AND step ILIKE '%Пресування%' AND batch_index IS NOT DISTINCT FROM v_task.batch_index 
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
      UPDATE public.tasks 
      SET status = 'in-progress',
          plan_snapshot = jsonb_set(COALESCE(plan_snapshot, '{}'::jsonb), '{arrivals}', v_arrivals)
      WHERE id = v_shop2_task.id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'task_id', p_task_id,
    'doc_id', v_doc_id,
    'arrivals', v_arrivals
  );
END;
$body$;

create or replace function public.vkya_add_route_inventory(
  p_nomenclature_id uuid,
  p_type text,
  p_quantity integer
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_inventory_id uuid;
  v_name text;
  v_unit text;
  v_warehouse text;
begin

  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;
  if p_quantity is null or p_quantity <= 0 or p_type is null then return; end if;

  perform pg_advisory_xact_lock(hashtextextended('vkya-inventory:' || p_nomenclature_id::text || ':' || p_type, 0));

  v_warehouse := case
    when p_type in ('scrap_ready', 'scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3', 'scrap_cat_4', 'scrap_restoration') then 'operational'
    else 'sgp'
  end;

  select id into v_inventory_id
  from public.inventory
  where nomenclature_id = p_nomenclature_id
    and (
      (v_warehouse = 'sgp' and warehouse = 'sgp' and pocket_owner is null and type in ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
      or (type = p_type and warehouse = v_warehouse)
    )
  order by updated_at desc nulls last, id
  limit 1
  for update;

  if v_inventory_id is not null then
    update public.inventory
    set total_qty = coalesce(total_qty, 0) + p_quantity, updated_at = now()
    where id = v_inventory_id;
  else
    select name, unit into v_name, v_unit
    from public.nomenclatures where id = p_nomenclature_id;
    insert into public.inventory (
      nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, updated_at
    ) values (
      p_nomenclature_id, coalesce(v_name, 'Деталь'), coalesce(v_unit, 'шт'),
      p_quantity, 0, p_type, v_warehouse, now()
    );
  end if;
end;
$body$;

create or replace function public.return_legacy_restoration_to_bz(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_inventory_id uuid;
  v_inventory_qty numeric;
  v_nom_name text;
  v_nom_unit text;
begin

  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;
  select * into v_restoration from public.vkya_restoration_cards
  where id = p_restoration_card_id for update;
  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.status <> 'completed' then raise exception 'Спочатку завершіть карту відновлення'; end if;
  if v_restoration.completed_quantity <= 0 then raise exception 'Немає відновлених деталей для повернення'; end if;
  if v_restoration.route_card_id is not null or v_restoration.shop2_card_id is not null then
    raise exception 'Карту вже оброблено';
  end if;

  select name, unit into v_nom_name, v_nom_unit
    from public.nomenclatures where id = v_restoration.nomenclature_id;

  select id, total_qty into v_inventory_id, v_inventory_qty
    from public.inventory
   where nomenclature_id = v_restoration.nomenclature_id
     and (
       (warehouse = 'sgp' and pocket_owner is null and type in ('finished', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2', 'part', 'product'))
       or (type = 'bz' and warehouse = 'operational')
     )
   order by updated_at desc nulls last limit 1 for update;

  if v_inventory_id is null then
    insert into public.inventory (nomenclature_id, name, unit, total_qty, reserved_qty, type, warehouse, pocket_owner, updated_at)
    values (v_restoration.nomenclature_id, coalesce(v_nom_name, 'Деталь'), coalesce(v_nom_unit, 'шт'), v_restoration.completed_quantity, 0, 'bz', 'sgp', null, now());
  else
    update public.inventory set total_qty = coalesce(v_inventory_qty, 0) + v_restoration.completed_quantity, updated_at = now()
     where id = v_inventory_id;
  end if;

  update public.vkya_restoration_cards set
    route_card_id = '00000000-0000-0000-0000-000000000000',
    returned_to_route_at = now(),
    returned_to_route_by = nullif(btrim(p_returned_by), ''),
    updated_at = now()
  where id = v_restoration.id;
end;
$body$;

create or replace function public.return_vkya_restoration_to_route(
  p_restoration_card_id uuid,
  p_returned_by text default null
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $body$
declare
  v_restoration public.vkya_restoration_cards%rowtype;
  v_history public.work_card_history%rowtype;
  v_source public.work_cards%rowtype;
  v_target_status text;
  v_target_operation text;
  v_target_inventory text;
  v_route_card_id uuid;
  v_task_id uuid;
  v_order_id uuid;
  v_can_merge boolean;
  v_manager_name text;
  v_shift_name text;
begin

  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;
  select * into v_restoration
  from public.vkya_restoration_cards
  where id = p_restoration_card_id
  for update;

  if not found then raise exception 'Карту відновлення не знайдено'; end if;
  if v_restoration.route_card_id is not null then return v_restoration.route_card_id; end if;
  if v_restoration.status <> 'completed' or coalesce(v_restoration.completed_quantity, 0) <= 0 then
    raise exception 'Спочатку завершіть карту та вкажіть відновлену кількість';
  end if;

  -- 1. Fetch source history if present
  if v_restoration.source_history_id is not null then
    select * into v_history
    from public.work_card_history
    where id = v_restoration.source_history_id;
  end if;

  -- 2. Fetch source card if present
  if coalesce(v_restoration.source_card_id, v_history.card_id) is not null then
    select * into v_source
    from public.work_cards
    where id = coalesce(v_restoration.source_card_id, v_history.card_id);
  end if;

  -- 3. Resolve task_id resiliently and validate against public.tasks
  v_task_id := coalesce(v_restoration.source_task_id, v_source.task_id, v_history.task_id);
  
  if v_task_id is not null then
    select id into v_task_id
    from public.tasks
    where id = v_task_id;
  end if;

  if v_task_id is null and v_restoration.source_order_id is not null then
    select id into v_task_id
    from public.tasks
    where order_id = v_restoration.source_order_id
    order by created_at desc
    limit 1;
  end if;

  if v_task_id is null and coalesce(v_source.order_id, v_history.task_id) is not null then
    select id into v_task_id
    from public.tasks
    where order_id = coalesce(v_source.order_id, v_history.task_id)
    order by created_at desc
    limit 1;
  end if;

  if v_task_id is null then
    select wc.task_id into v_task_id
    from public.work_cards wc
    join public.tasks t on t.id = wc.task_id
    where wc.nomenclature_id = v_restoration.nomenclature_id
    order by wc.created_at desc
    limit 1;
  end if;

  -- Final validation of v_task_id against public.tasks table
  if v_task_id is not null then
    perform 1 from public.tasks where id = v_task_id;
    if not found then
      v_task_id := null;
    end if;
  end if;

  if v_task_id is not null then
    select order_id into v_order_id
    from public.tasks
    where id = v_task_id;
  end if;

  v_order_id := coalesce(v_order_id, v_restoration.source_order_id, v_source.order_id);
  if v_order_id is not null then
    perform 1 from public.orders where id = v_order_id;
    if not found then
      v_order_id := null;
    end if;
  end if;

  v_manager_name := coalesce(v_source.manager_name, v_history.manager_name, '—');
  v_shift_name := coalesce(v_source.shift_name, v_history.shift_name, '—');

  -- All restored parts from VKYA return directly to Shop 2 Buffer (at-shop2-buffer)
  v_target_status := 'at-shop2-buffer';
  v_target_operation := 'Сортування';
  v_target_inventory := 'semi_shop2';

  if v_source.id is not null and v_source.status = v_target_status
     and lower(btrim(coalesce(v_source.operation, ''))) = lower(btrim(coalesce(v_target_operation, ''))) then
    v_can_merge := true;
    v_route_card_id := v_source.id;
  else
    select id into v_route_card_id
    from public.work_cards
    where (task_id = v_task_id or (task_id is null and v_task_id is null))
      and nomenclature_id = v_restoration.nomenclature_id
      and status = v_target_status
      and lower(btrim(coalesce(operation, ''))) = lower(btrim(coalesce(v_target_operation, '')))
    order by created_at desc
    limit 1;
    v_can_merge := (v_route_card_id is not null);
  end if;

  if v_can_merge then
    update public.work_cards
    set quantity = coalesce(quantity, 0) + v_restoration.completed_quantity,
        card_info = concat_ws(' ', nullif(btrim(coalesce(card_info, '')), ''),
          format('[VKYA_RETURN:%s:%s] [VKYA_RESTORED_RETURN:%s:%s]',
            v_restoration.id, v_restoration.completed_quantity,
            v_restoration.id, v_restoration.completed_quantity))
    where id = v_route_card_id;
  else
    insert into public.work_cards (
      task_id, order_id, nomenclature_id, quantity, operation, status,
      machine, manager_name, shift_name, card_info
    ) values (
      v_task_id, v_order_id,
      v_restoration.nomenclature_id, v_restoration.completed_quantity,
      v_target_operation, v_target_status, '—', v_manager_name, v_shift_name,
      format('[VKYA_RETURN:%s:%s] [VKYA_RESTORED_RETURN:%s:%s] [SOURCE_CARD:%s] [SOURCE_HISTORY:%s] Повернено в Буфер Цеху №2 після відновлення ВКЯ',
        v_restoration.id, v_restoration.completed_quantity,
        v_restoration.id, v_restoration.completed_quantity,
        coalesce(v_source.id::text, '—'), coalesce(v_history.id::text, '—'))
    ) returning id into v_route_card_id;
  end if;

  if v_target_inventory is not null then
    perform public.vkya_add_route_inventory(v_restoration.nomenclature_id, v_target_inventory, v_restoration.completed_quantity);
  end if;

  -- Create history entry in work_card_history so returned card appears in Shop 1 Card Archive (Архів карток Цеху 1)
  insert into public.work_card_history (
    card_id, nomenclature_id, task_id, stage_name, operator_name,
    qty_at_start, qty_completed, scrap_qty, started_at, completed_at, created_at,
    is_archived_scrap, machine, manager_name, shift_name, card_info
  ) values (
    v_route_card_id, v_restoration.nomenclature_id, v_task_id,
    v_restoration.restoration_stage || ' (Відновлено ВКЯ)',
    coalesce(v_restoration.operator_name, nullif(btrim(p_returned_by), ''), 'Термінал відновлення ВКЯ'),
    v_restoration.completed_quantity, v_restoration.completed_quantity, 0,
    coalesce(v_restoration.started_at, v_restoration.created_at, now()),
    now(), now(), false, '—', v_manager_name, v_shift_name,
    format('[VKYA_RETURN:%s:%s] [VKYA_RESTORED_RETURN:%s:%s] Відновлено та повернуто в наряд із ВКЯ',
      v_restoration.id, v_restoration.completed_quantity,
      v_restoration.id, v_restoration.completed_quantity)
  );

  -- Record resolution so Shop 1 / Foreman report queries see the returned count (if source history exists)
  if v_restoration.source_history_id is not null and exists (select 1 from public.work_card_history where id = v_restoration.source_history_id) then
    insert into public.vkya_quality_resolutions (
      source_history_id, source_card_id, task_id, order_id, nomenclature_id,
      quantity, disposition, route_card_id, restoration_card_id, resolved_by_name
    ) values (
      v_restoration.source_history_id,
      case when exists (select 1 from public.work_cards where id = v_restoration.source_card_id) then v_restoration.source_card_id else null end,
      v_task_id, v_order_id,
      v_restoration.nomenclature_id, v_restoration.completed_quantity, 'returned_to_route',
      v_route_card_id, null, nullif(btrim(p_returned_by), '')
    )
    on conflict do nothing;
  end if;

  update public.vkya_restoration_cards
  set route_card_id = v_route_card_id,
      returned_to_route_at = now(),
      returned_to_route_by = nullif(btrim(p_returned_by), ''),
      updated_at = now()
  where id = v_restoration.id;

  return v_route_card_id;
end;
$body$;
REVOKE ALL ON FUNCTION public.rpc_deduct_inventory_atomic(uuid,numeric,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_deduct_inventory_atomic(uuid,numeric,numeric) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_reserve_material_atomic(uuid,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_reserve_material_atomic(uuid,numeric,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_increment_inventory_stock(uuid,numeric,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_increment_inventory_stock(uuid,numeric,text,text,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_qc_scrap_atomic(uuid,numeric,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_qc_scrap_atomic(uuid,numeric,jsonb,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_submit_sorting_complete_atomic(uuid,numeric,numeric,numeric,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_submit_sorting_complete_atomic(uuid,numeric,numeric,numeric,text,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_handover_to_sgp_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_handover_to_sgp_atomic(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.rpc_handover_task_to_shop2_atomic(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_handover_task_to_shop2_atomic(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.vkya_add_route_inventory(uuid,text,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vkya_add_route_inventory(uuid,text,integer) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.return_legacy_restoration_to_bz(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_legacy_restoration_to_bz(uuid,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.return_vkya_restoration_to_route(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.return_vkya_restoration_to_route(uuid,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.vkya_add_route_inventory(uuid,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_legacy_restoration_to_bz(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_vkya_restoration_to_route(uuid,text) FROM PUBLIC, anon;
COMMIT;
