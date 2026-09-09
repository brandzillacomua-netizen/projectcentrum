-- REVIEW / TEST CANDIDATE ONLY. Not part of automatic migrations.
-- Install as database owner. No grants to application roles; no live UI imports.
-- Existing stock and requests are not changed by installation.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA shop1_v2;
REVOKE ALL ON SCHEMA shop1_v2 FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE shop1_v2.settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  accept_new_tasks boolean NOT NULL DEFAULT false,
  completion_enabled boolean NOT NULL DEFAULT false
);
INSERT INTO shop1_v2.settings DEFAULT VALUES;
CREATE TABLE shop1_v2.tasks (
  task_id uuid PRIMARY KEY REFERENCES public.tasks(id),
  enrolled_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shop1_v2.reservations (
  request_id uuid PRIMARY KEY REFERENCES public.material_requests(id),
  task_id uuid NOT NULL REFERENCES shop1_v2.tasks(task_id),
  inventory_id uuid NOT NULL REFERENCES public.inventory(id),
  kind text NOT NULL CHECK (kind IN ('sheet','cutter')),
  initial_qty numeric NOT NULL CHECK (initial_qty > 0 AND initial_qty < 2147483648 AND initial_qty = trunc(initial_qty))
);
CREATE UNIQUE INDEX one_sheet_reservation_per_task_stock ON shop1_v2.reservations(task_id,inventory_id) WHERE kind='sheet';
CREATE TABLE shop1_v2.batches (
  task_id uuid NOT NULL REFERENCES shop1_v2.tasks(task_id),
  batch_key text NOT NULL CHECK (length(batch_key) BETWEEN 1 AND 128),
  payload jsonb NOT NULL,
  card_ids uuid[] NOT NULL,
  PRIMARY KEY (task_id, batch_key)
);
CREATE TABLE shop1_v2.cards (
  card_id uuid PRIMARY KEY REFERENCES public.work_cards(id),
  task_id uuid NOT NULL REFERENCES shop1_v2.tasks(task_id),
  initial_piece_qty integer NOT NULL CHECK (initial_piece_qty > 0),
  finalized_at timestamptz
);
CREATE TABLE shop1_v2.allocations (
  card_id uuid NOT NULL REFERENCES shop1_v2.cards(card_id),
  request_id uuid NOT NULL REFERENCES shop1_v2.reservations(request_id),
  planned_qty numeric NOT NULL CHECK (planned_qty > 0 AND planned_qty < 2147483648 AND planned_qty = trunc(planned_qty)),
  PRIMARY KEY (card_id, request_id)
);
CREATE TABLE shop1_v2.completions (
  card_id uuid PRIMARY KEY REFERENCES shop1_v2.cards(card_id),
  payload jsonb NOT NULL,
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE shop1_v2.movements (
  card_id uuid NOT NULL REFERENCES shop1_v2.completions(card_id),
  request_id uuid NOT NULL REFERENCES shop1_v2.reservations(request_id),
  consumed numeric NOT NULL CHECK (consumed >= 0),
  released numeric NOT NULL CHECK (released >= consumed),
  total_before numeric NOT NULL,
  total_after numeric NOT NULL,
  reserve_before numeric NOT NULL,
  reserve_after numeric NOT NULL,
  PRIMARY KEY (card_id, request_id)
);
CREATE TABLE shop1_v2.scrap_movements (
  card_id uuid PRIMARY KEY REFERENCES shop1_v2.completions(card_id),
  inventory_id uuid NOT NULL REFERENCES public.inventory(id),
  quantity integer NOT NULL CHECK (quantity > 0),
  total_before numeric NOT NULL,
  total_after numeric NOT NULL
);

-- Admin-only enrollment of a NEW, fully approved task with existing issued
-- reservations. Does not reserve stock again, infer material names, or backfill cards.
CREATE FUNCTION public.shop1_v2_enroll(p_task_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, shop1_v2 AS $$
DECLARE v_task public.tasks%rowtype; v_req public.material_requests%rowtype;
BEGIN
  PERFORM pg_advisory_xact_lock(724019, 1);
  IF EXISTS (SELECT 1 FROM shop1_v2.tasks WHERE task_id=p_task_id) THEN RETURN; END IF;
  IF NOT (SELECT accept_new_tasks FROM shop1_v2.settings WHERE id) THEN RAISE EXCEPTION 'V2 enrollment disabled'; END IF;
  LOCK TABLE public.work_cards IN SHARE ROW EXCLUSIVE MODE;
  SELECT * INTO STRICT v_task FROM public.tasks WHERE id=p_task_id FOR UPDATE;
  IF v_task.warehouse_conf IS DISTINCT FROM 'true' OR v_task.engineer_conf IS DISTINCT FROM true OR v_task.director_conf IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Three full approvals required';
  END IF;
  IF EXISTS (SELECT 1 FROM public.work_cards WHERE task_id=p_task_id) THEN RAISE EXCEPTION 'Only tasks without cards may enroll'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.material_requests WHERE task_id=p_task_id AND category='sheet') THEN
    RAISE EXCEPTION 'Explicit issued sheet requests required';
  END IF;
  INSERT INTO shop1_v2.tasks(task_id) VALUES(p_task_id);
  FOR v_req IN SELECT * FROM public.material_requests WHERE task_id=p_task_id AND category='sheet' ORDER BY id FOR UPDATE LOOP
    IF v_req.status IS DISTINCT FROM 'issued' OR v_req.inventory_id IS NULL OR v_req.card_id IS NOT NULL THEN
      RAISE EXCEPTION 'Only complete task-level issued sheet reservations may enroll';
    END IF;
    INSERT INTO shop1_v2.reservations VALUES(v_req.id,p_task_id,v_req.inventory_id,'sheet',v_req.quantity);
  END LOOP;
END;
$$;

-- Shared check: inventory must agree with ALL issued requests, including other tasks.
CREATE FUNCTION shop1_v2.check_stock(p_inventory_id uuid) RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public, shop1_v2 AS $$
DECLARE v_inv public.inventory%rowtype; v_reserved numeric;
BEGIN
  SELECT * INTO STRICT v_inv FROM public.inventory WHERE id=p_inventory_id FOR UPDATE;
  SELECT coalesce(sum(quantity),0) INTO v_reserved FROM public.material_requests WHERE inventory_id=p_inventory_id AND status='issued';
  IF v_inv.total_qty IS NULL OR v_inv.reserved_qty IS NULL OR v_reserved < 0 OR v_inv.reserved_qty <> v_reserved
    OR v_inv.total_qty < v_reserved OR v_inv.total_qty >= 2147483648 OR v_inv.total_qty <> trunc(v_inv.total_qty) THEN
    RAISE EXCEPTION 'Inconsistent inventory/reservations for %; reconcile explicitly before enrollment', p_inventory_id;
  END IF;
END;
$$;

-- Warehouse command for a new task: reserve all explicit pending sheet requests
-- once, without consuming physical stock. Partial issuance is deliberately rejected.
-- Engineer/director approvals remain unchanged; create_cards checks all three.
CREATE FUNCTION public.shop1_v2_reserve_sheets(p_task_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, shop1_v2 AS $$
DECLARE v_req public.material_requests%rowtype; v_inv public.inventory%rowtype; v_stock uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(724019,1);
  IF EXISTS(SELECT 1 FROM shop1_v2.tasks WHERE task_id=p_task_id) THEN RETURN; END IF;
  IF NOT (SELECT accept_new_tasks FROM shop1_v2.settings WHERE id) THEN RAISE EXCEPTION 'V2 enrollment disabled'; END IF;
  LOCK TABLE public.work_cards IN SHARE ROW EXCLUSIVE MODE;
  PERFORM 1 FROM public.tasks WHERE id=p_task_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task not found'; END IF;
  IF EXISTS(SELECT 1 FROM public.work_cards WHERE task_id=p_task_id) THEN RAISE EXCEPTION 'Only tasks without cards may enroll'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.material_requests WHERE task_id=p_task_id AND category='sheet') THEN RAISE EXCEPTION 'Explicit pending sheet requests required'; END IF;
  PERFORM 1 FROM public.material_requests WHERE task_id=p_task_id AND category='sheet' ORDER BY id FOR UPDATE;
  FOR v_stock IN SELECT DISTINCT inventory_id FROM public.material_requests WHERE task_id=p_task_id AND category='sheet' AND inventory_id IS NOT NULL ORDER BY inventory_id LOOP
    PERFORM shop1_v2.check_stock(v_stock);
  END LOOP;
  INSERT INTO shop1_v2.tasks(task_id) VALUES(p_task_id);
  PERFORM set_config('shop1.v2_writer','on',true);
  FOR v_req IN SELECT * FROM public.material_requests WHERE task_id=p_task_id AND category='sheet' ORDER BY inventory_id,id LOOP
    IF v_req.status IS DISTINCT FROM 'pending' OR v_req.inventory_id IS NULL OR v_req.card_id IS NOT NULL THEN RAISE EXCEPTION 'Only complete pending task sheet requests may reserve'; END IF;
    SELECT * INTO STRICT v_inv FROM public.inventory WHERE id=v_req.inventory_id;
    IF v_inv.warehouse IS DISTINCT FROM 'operational' OR v_inv.total_qty-v_inv.reserved_qty<v_req.quantity THEN RAISE EXCEPTION 'Insufficient operational sheet stock'; END IF;
    INSERT INTO shop1_v2.reservations VALUES(v_req.id,p_task_id,v_req.inventory_id,'sheet',v_req.quantity);
    UPDATE public.material_requests SET status='issued' WHERE id=v_req.id;
    UPDATE public.inventory SET reserved_qty=v_inv.reserved_qty+v_req.quantity,updated_at=now() WHERE id=v_req.inventory_id;
    PERFORM shop1_v2.check_stock(v_req.inventory_id);
  END LOOP;
  UPDATE public.tasks SET warehouse_conf='true' WHERE id=p_task_id;
  PERFORM set_config('shop1.v2_writer','off',true);
END;
$$;

-- p_cards: [{nomenclature_id,machine,quantity,card_info,allocations:
-- [{request_id,kind:sheet|cutter,planned_qty}]}]. Exactly one explicit sheet line/card.
-- Requests must already be issued to THIS task. No new sheet request is generated.
CREATE FUNCTION public.shop1_v2_create_cards(p_task_id uuid,p_batch_key text,p_cards jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, shop1_v2 AS $$
DECLARE v_task public.tasks%rowtype; v_card jsonb; v_line jsonb; v_id uuid;
  v_ids uuid[] := '{}'; v_req public.material_requests%rowtype; v_res shop1_v2.reservations%rowtype;
  v_qty numeric; v_used numeric; v_old shop1_v2.batches%rowtype; v_stock uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(724019,1);
  SELECT * INTO v_old FROM shop1_v2.batches WHERE task_id=p_task_id AND batch_key=p_batch_key;
  IF FOUND THEN
    IF v_old.payload IS DISTINCT FROM p_cards THEN RAISE EXCEPTION 'Batch key reused with different payload'; END IF;
    RETURN to_jsonb(v_old.card_ids);
  END IF;
  IF NOT (SELECT completion_enabled FROM shop1_v2.settings WHERE id) THEN RAISE EXCEPTION 'V2 generation disabled'; END IF;
  PERFORM 1 FROM shop1_v2.tasks WHERE task_id=p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task is not enrolled'; END IF;
  SELECT * INTO STRICT v_task FROM public.tasks WHERE id=p_task_id FOR UPDATE;
  IF v_task.warehouse_conf IS DISTINCT FROM 'true' OR v_task.engineer_conf IS DISTINCT FROM true OR v_task.director_conf IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Three full approvals required';
  END IF;
  IF p_cards IS NULL OR jsonb_typeof(p_cards) <> 'array' OR jsonb_array_length(p_cards) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Expected 1..100 cards'; END IF;
  -- Lock order: shared V2 advisory lock, task, requests, inventory; stable UUID order.
  PERFORM 1 FROM public.material_requests WHERE task_id=p_task_id ORDER BY id FOR UPDATE;
  FOR v_stock IN SELECT DISTINCT inventory_id FROM public.material_requests WHERE task_id=p_task_id AND inventory_id IS NOT NULL ORDER BY inventory_id LOOP
    PERFORM shop1_v2.check_stock(v_stock);
  END LOOP;
  PERFORM set_config('shop1.v2_writer','on',true);
  FOR v_card IN SELECT value FROM jsonb_array_elements(p_cards) LOOP
    v_qty := (v_card->>'quantity')::numeric;
    IF v_qty IS NULL OR v_qty <= 0 OR v_qty >= 2147483648 OR v_qty <> trunc(v_qty) THEN RAISE EXCEPTION 'Positive integer piece quantity required'; END IF;
    IF jsonb_typeof(v_card->'allocations') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Explicit allocations required'; END IF;
    IF (SELECT count(*) FROM jsonb_array_elements(v_card->'allocations') x WHERE x->>'kind'='sheet') <> 1 THEN RAISE EXCEPTION 'Exactly one sheet allocation required'; END IF;
    IF coalesce(v_card->>'card_info','') ~ '(SHEETS_DEDUCTED|CUTTERS_DEDUCTED|MATERIALS_ISSUED)' THEN RAISE EXCEPTION 'New cards cannot carry deduction markers'; END IF;
    INSERT INTO public.work_cards(task_id,order_id,nomenclature_id,operation,status,quantity,machine,card_info)
    VALUES(p_task_id,v_task.order_id,(v_card->>'nomenclature_id')::uuid,'Розкрій','new',v_qty,v_card->>'machine',coalesce(v_card->>'card_info','')) RETURNING id INTO v_id;
    INSERT INTO shop1_v2.cards(card_id,task_id,initial_piece_qty) VALUES(v_id,p_task_id,v_qty);
    FOR v_line IN SELECT value FROM jsonb_array_elements(v_card->'allocations') LOOP
      SELECT * INTO STRICT v_req FROM public.material_requests WHERE id=(v_line->>'request_id')::uuid;
      IF v_req.task_id IS DISTINCT FROM p_task_id OR v_req.status IS DISTINCT FROM 'issued' OR v_req.card_id IS NOT NULL OR v_req.inventory_id IS NULL THEN RAISE EXCEPTION 'Request must be issued to this task'; END IF;
      IF v_line->>'kind'='cutter' AND v_req.category IS NOT DISTINCT FROM 'sheet' THEN RAISE EXCEPTION 'Sheet request cannot be a cutter'; END IF;
      SELECT * INTO v_res FROM shop1_v2.reservations WHERE request_id=v_req.id;
      IF NOT FOUND THEN
        IF v_line->>'kind' IS DISTINCT FROM 'cutter' THEN RAISE EXCEPTION 'Sheet request must belong to enrollment'; END IF;
        INSERT INTO shop1_v2.reservations VALUES(v_req.id,p_task_id,v_req.inventory_id,'cutter',v_req.quantity) RETURNING * INTO v_res;
      END IF;
      IF v_res.kind IS DISTINCT FROM v_line->>'kind' OR v_res.inventory_id IS DISTINCT FROM v_req.inventory_id THEN RAISE EXCEPTION 'Reservation identity mismatch'; END IF;
      v_qty := (v_line->>'planned_qty')::numeric;
      SELECT coalesce(sum(a.planned_qty),0) INTO v_used FROM shop1_v2.allocations a WHERE a.request_id=v_req.id;
      IF v_qty IS NULL OR v_qty <= 0 OR v_qty <> trunc(v_qty) OR v_used+v_qty > v_res.initial_qty THEN RAISE EXCEPTION 'Allocation exceeds original reservation'; END IF;
      INSERT INTO shop1_v2.allocations VALUES(v_id,v_req.id,v_qty);
    END LOOP;
    IF EXISTS (SELECT 1 FROM shop1_v2.allocations a JOIN shop1_v2.reservations r USING(request_id) WHERE a.card_id=v_id GROUP BY r.inventory_id HAVING count(*)>1) THEN RAISE EXCEPTION 'One inventory row cannot serve two allocation lines'; END IF;
    v_ids := array_append(v_ids,v_id);
  END LOOP;
  INSERT INTO shop1_v2.batches VALUES(p_task_id,p_batch_key,p_cards,v_ids);
  PERFORM set_config('shop1.v2_writer','off',true);
  RETURN to_jsonb(v_ids);
END;
$$;

-- p_actual: JSON object request UUID -> actual cutter quantity. Explicit zero required.
-- Scrap requires an explicit matching scrap_ready row; never select the first
-- matching stock item or create one with ambiguous ownership. Restoration must
-- be installed and executes inside this transaction, without a client fallback.
CREATE FUNCTION public.shop1_v2_complete_cutting(p_card_id uuid,p_actual jsonb,p_operator text,p_shift text,
  p_scrap_qty integer DEFAULT 0,p_scrap_inventory_id uuid DEFAULT NULL,p_scrap_operator text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, shop1_v2 AS $$
DECLARE v_card public.work_cards%rowtype; v_managed shop1_v2.cards%rowtype;
  v_event shop1_v2.completions%rowtype; v_payload jsonb; v_result jsonb;
  v_line record; v_req public.material_requests%rowtype; v_inv public.inventory%rowtype;
  v_stock uuid; v_actual numeric; v_cutters numeric := 0; v_lines jsonb := '[]';
  v_total numeric; v_reserved numeric; v_remaining numeric; v_info text; v_restoration jsonb;
  v_scrap public.inventory%rowtype; v_good integer; v_scrap_actor text;
BEGIN
  PERFORM pg_advisory_xact_lock(724019,1);
  v_payload := jsonb_build_object('actual',p_actual,'operator',p_operator,'shift',p_shift,
    'scrap_qty',p_scrap_qty,'scrap_inventory_id',p_scrap_inventory_id,'scrap_operator',p_scrap_operator);
  SELECT * INTO v_event FROM shop1_v2.completions WHERE card_id=p_card_id;
  IF FOUND THEN
    IF v_event.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Card already finalized with different facts'; END IF;
    RETURN v_event.result || jsonb_build_object('replay',true);
  END IF;
  IF NOT (SELECT completion_enabled FROM shop1_v2.settings WHERE id) THEN RAISE EXCEPTION 'V2 completion disabled'; END IF;
  SELECT * INTO STRICT v_managed FROM shop1_v2.cards WHERE card_id=p_card_id FOR UPDATE;
  SELECT * INTO STRICT v_card FROM public.work_cards WHERE id=p_card_id FOR UPDATE;
  IF v_managed.finalized_at IS NOT NULL OR v_card.task_id IS DISTINCT FROM v_managed.task_id
    OR v_card.operation IS DISTINCT FROM 'Розкрій' OR v_card.status IS DISTINCT FROM 'in-progress'
    OR v_card.quantity IS DISTINCT FROM v_managed.initial_piece_qty THEN RAISE EXCEPTION 'Card is not eligible for cutting completion'; END IF;
  IF p_scrap_qty IS NULL OR p_scrap_qty<0 OR p_scrap_qty>v_card.quantity OR (p_scrap_qty>0 AND p_scrap_inventory_id IS NULL)
    OR (p_scrap_qty=0 AND p_scrap_inventory_id IS NOT NULL) THEN RAISE EXCEPTION 'Invalid scrap quantity or missing explicit scrap stock'; END IF;
  v_good := v_card.quantity-p_scrap_qty;
  v_scrap_actor := coalesce(nullif(btrim(p_scrap_operator),''),p_operator);
  IF p_actual IS NULL OR jsonb_typeof(p_actual)<>'object' OR nullif(btrim(p_operator),'') IS NULL OR nullif(btrim(p_shift),'') IS NULL THEN RAISE EXCEPTION 'Explicit cutter facts, operator and shift required'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_actual) k WHERE NOT EXISTS (
    SELECT 1 FROM shop1_v2.allocations a JOIN shop1_v2.reservations r USING(request_id) WHERE a.card_id=p_card_id AND r.kind='cutter' AND a.request_id::text=k)) THEN RAISE EXCEPTION 'Unknown cutter fact'; END IF;
  PERFORM 1 FROM public.material_requests WHERE id IN (SELECT request_id FROM shop1_v2.allocations WHERE card_id=p_card_id) ORDER BY id FOR UPDATE;
  FOR v_stock IN SELECT r.inventory_id FROM shop1_v2.allocations a JOIN shop1_v2.reservations r USING(request_id) WHERE a.card_id=p_card_id
    UNION SELECT p_scrap_inventory_id WHERE p_scrap_inventory_id IS NOT NULL ORDER BY 1 LOOP
    PERFORM shop1_v2.check_stock(v_stock);
  END LOOP;
  IF p_scrap_qty>0 THEN
    SELECT * INTO STRICT v_scrap FROM public.inventory WHERE id=p_scrap_inventory_id;
    IF v_card.nomenclature_id IS NULL OR v_scrap.nomenclature_id IS DISTINCT FROM v_card.nomenclature_id OR v_scrap.type IS DISTINCT FROM 'scrap_ready'
      OR v_scrap.warehouse IS DISTINCT FROM 'operational' OR v_scrap.pocket_owner IS NOT NULL OR v_scrap.total_qty+p_scrap_qty>=2147483648
      OR EXISTS(SELECT 1 FROM shop1_v2.allocations a JOIN shop1_v2.reservations r USING(request_id) WHERE a.card_id=p_card_id AND r.inventory_id=p_scrap_inventory_id) THEN
      RAISE EXCEPTION 'Scrap inventory identity mismatch';
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM shop1_v2.allocations a JOIN shop1_v2.reservations r USING(request_id) WHERE a.card_id=p_card_id AND r.kind='sheet') THEN RAISE EXCEPTION 'Missing sheet allocation'; END IF;
  PERFORM set_config('shop1.v2_writer','on',true);
  FOR v_line IN SELECT a.*,r.inventory_id,r.kind FROM shop1_v2.allocations a JOIN shop1_v2.reservations r USING(request_id) WHERE a.card_id=p_card_id ORDER BY r.inventory_id LOOP
    SELECT * INTO STRICT v_req FROM public.material_requests WHERE id=v_line.request_id;
    SELECT * INTO STRICT v_inv FROM public.inventory WHERE id=v_line.inventory_id;
    v_actual := CASE WHEN v_line.kind='sheet' THEN v_line.planned_qty ELSE (p_actual->>v_line.request_id::text)::numeric END;
    IF v_actual IS NULL OR v_actual<0 OR v_actual<>trunc(v_actual) OR v_actual>v_line.planned_qty THEN RAISE EXCEPTION 'Cutter fact needs an explicit sufficient allocation'; END IF;
    IF v_req.status IS DISTINCT FROM 'issued' OR v_req.task_id IS DISTINCT FROM v_managed.task_id OR v_req.inventory_id IS DISTINCT FROM v_line.inventory_id
      OR v_req.quantity IS NULL OR v_req.quantity<v_line.planned_qty THEN RAISE EXCEPTION 'Insufficient or mismatched reservation'; END IF;
    v_total := v_inv.total_qty-v_actual;
    v_reserved := v_inv.reserved_qty-v_line.planned_qty;
    v_remaining := v_req.quantity-v_line.planned_qty;
    IF v_total<0 OR v_reserved<0 OR v_total<v_reserved THEN RAISE EXCEPTION 'Insufficient stock'; END IF;
    UPDATE public.material_requests SET quantity=v_remaining,status=CASE WHEN v_remaining=0 THEN 'completed' ELSE 'issued' END WHERE id=v_req.id;
    -- Works with the PROD reconcile trigger and with the TEST fixture without it.
    -- Set the exact expected reserve after request mutation, then verify its source.
    UPDATE public.inventory SET total_qty=v_total,reserved_qty=v_reserved,updated_at=now() WHERE id=v_inv.id;
    PERFORM shop1_v2.check_stock(v_inv.id);
    IF v_line.kind='cutter' THEN v_cutters := v_cutters+v_actual; END IF;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object('request_id',v_req.id,'consumed',v_actual,'released',v_line.planned_qty,'total_before',v_inv.total_qty,'total_after',v_total,'reserve_before',v_inv.reserved_qty,'reserve_after',v_reserved));
  END LOOP;
  IF v_cutters>0 THEN
    IF to_regprocedure('public.register_cutter_usage(uuid,jsonb,bigint,text,jsonb)') IS NULL THEN RAISE EXCEPTION 'Cutter restoration dependency missing'; END IF;
    SELECT jsonb_agg(jsonb_build_object('nomenclature_id',x.nomenclature_id,'quantity',x.qty)) INTO v_restoration
    FROM (SELECT i.nomenclature_id,sum((p_actual->>a.request_id::text)::numeric) qty
      FROM shop1_v2.allocations a JOIN shop1_v2.reservations r USING(request_id) JOIN public.inventory i ON i.id=r.inventory_id
      WHERE a.card_id=p_card_id AND r.kind='cutter' GROUP BY i.nomenclature_id HAVING sum((p_actual->>a.request_id::text)::numeric)>0) x;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_restoration) x WHERE x->>'nomenclature_id' IS NULL) THEN RAISE EXCEPTION 'Explicit cutter nomenclature required'; END IF;
    EXECUTE 'SELECT public.register_cutter_usage($1,$2,$3,$4,$5)' USING p_card_id,v_restoration,NULL::bigint,p_operator,
      jsonb_build_object('operator_name',p_operator,'manager_name',v_card.manager_name,'machine_name',v_card.machine);
  END IF;
  v_info := concat(coalesce(v_card.card_info,''),' [SHEETS_DEDUCTED:true] [CUTTERS_DEDUCTED:true]');
  UPDATE public.work_cards SET status='at-buffer',quantity=v_good,completed_at=now(),operator_name=p_operator,shift_name=p_shift,cutters_used=v_cutters,card_info=v_info WHERE id=p_card_id;
  IF p_scrap_qty>0 AND v_scrap_actor<>p_operator THEN
    IF v_good>0 THEN
      INSERT INTO public.work_card_history(card_id,task_id,nomenclature_id,stage_name,operator_name,qty_at_start,qty_completed,scrap_qty,cutters_used,started_at,completed_at,shift_name,manager_name,machine_name,card_info,is_archived_scrap)
      VALUES(p_card_id,v_card.task_id,v_card.nomenclature_id,'Розкрій',p_operator,v_good,v_good,0,v_cutters,v_card.started_at,now(),p_shift,v_card.manager_name,v_card.machine,v_info,false);
    END IF;
    INSERT INTO public.work_card_history(card_id,task_id,nomenclature_id,stage_name,operator_name,qty_at_start,qty_completed,scrap_qty,cutters_used,started_at,completed_at,shift_name,manager_name,machine_name,card_info,is_archived_scrap)
    VALUES(p_card_id,v_card.task_id,v_card.nomenclature_id,'Розкрій',v_scrap_actor,p_scrap_qty,0,p_scrap_qty,CASE WHEN v_good=0 THEN v_cutters ELSE 0 END,v_card.started_at,now(),p_shift,v_card.manager_name,v_card.machine,v_info||' [SCRAP_ASSIGNED]',true);
  ELSE
    INSERT INTO public.work_card_history(card_id,task_id,nomenclature_id,stage_name,operator_name,qty_at_start,qty_completed,scrap_qty,cutters_used,started_at,completed_at,shift_name,manager_name,machine_name,card_info,is_archived_scrap)
    VALUES(p_card_id,v_card.task_id,v_card.nomenclature_id,'Розкрій',p_operator,v_card.quantity,v_good,p_scrap_qty,v_cutters,v_card.started_at,now(),p_shift,v_card.manager_name,v_card.machine,v_info,p_scrap_qty>0);
  END IF;
  IF p_scrap_qty>0 THEN UPDATE public.inventory SET total_qty=total_qty+p_scrap_qty,updated_at=now() WHERE id=p_scrap_inventory_id; END IF;
  v_result := jsonb_build_object('card_id',p_card_id,'status','at-buffer','lines',v_lines,'replay',false,'good_qty',v_good,'scrap_qty',p_scrap_qty);
  INSERT INTO shop1_v2.completions(card_id,payload,result) VALUES(p_card_id,v_payload,v_result);
  INSERT INTO shop1_v2.movements SELECT p_card_id,x.request_id,x.consumed,x.released,x.total_before,x.total_after,x.reserve_before,x.reserve_after
    FROM jsonb_to_recordset(v_lines) x(request_id uuid,consumed numeric,released numeric,total_before numeric,total_after numeric,reserve_before numeric,reserve_after numeric);
  IF p_scrap_qty>0 THEN INSERT INTO shop1_v2.scrap_movements VALUES(p_card_id,p_scrap_inventory_id,p_scrap_qty,v_scrap.total_qty,v_scrap.total_qty+p_scrap_qty); END IF;
  UPDATE shop1_v2.cards SET finalized_at=now() WHERE card_id=p_card_id;
  PERFORM set_config('shop1.v2_writer','off',true);
  RETURN v_result;
END;
$$;

-- Keep managed records out of legacy writes. Ordinary tasks are unaffected.
CREATE FUNCTION shop1_v2.guard_managed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, shop1_v2 AS $$
DECLARE v_owned boolean; v_internal boolean;
BEGIN
  v_internal := current_setting('shop1.v2_writer',true)='on' AND current_user=pg_get_userbyid((SELECT nspowner FROM pg_namespace WHERE nspname='shop1_v2'));
  IF v_internal IS TRUE THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
  IF TG_TABLE_NAME='material_requests' THEN
    IF TG_OP='INSERT' THEN
      IF NEW.category='sheet' AND EXISTS(SELECT 1 FROM shop1_v2.tasks WHERE task_id=NEW.task_id) THEN RAISE EXCEPTION 'Enrolled task cannot reserve sheets again'; END IF;
    ELSE
      SELECT EXISTS(SELECT 1 FROM shop1_v2.reservations WHERE request_id=OLD.id) INTO v_owned;
      IF v_owned THEN RAISE EXCEPTION 'Managed reservation requires V2 writer'; END IF;
      IF TG_OP='UPDATE' AND NEW.category='sheet' AND EXISTS(SELECT 1 FROM shop1_v2.tasks WHERE task_id=NEW.task_id) THEN RAISE EXCEPTION 'Cannot move a sheet request into an enrolled task'; END IF;
    END IF;
  ELSE
    IF TG_OP='INSERT' THEN
      IF EXISTS(SELECT 1 FROM shop1_v2.tasks WHERE task_id=NEW.task_id) THEN RAISE EXCEPTION 'Managed task requires V2 card generation'; END IF;
    ELSE
      SELECT EXISTS(SELECT 1 FROM shop1_v2.cards WHERE card_id=OLD.id) INTO v_owned;
      IF v_owned AND (TG_OP='DELETE' OR NEW.task_id IS DISTINCT FROM OLD.task_id OR NEW.nomenclature_id IS DISTINCT FROM OLD.nomenclature_id) THEN RAISE EXCEPTION 'Managed card identity is immutable'; END IF;
      IF v_owned AND EXISTS(SELECT 1 FROM shop1_v2.cards WHERE card_id=OLD.id AND finalized_at IS NULL)
        AND (NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.operation IS DISTINCT FROM OLD.operation OR NEW.card_info IS DISTINCT FROM OLD.card_info OR NEW.status IS NULL OR NEW.status NOT IN ('new','in-progress','paused')) THEN
        RAISE EXCEPTION 'Managed cutting completion requires V2 writer';
      END IF;
      IF v_owned AND EXISTS(SELECT 1 FROM shop1_v2.cards WHERE card_id=OLD.id AND finalized_at IS NOT NULL) AND NEW.operation='Розкрій' AND NEW.status IN ('new','in-progress','paused') THEN RAISE EXCEPTION 'Cutting cannot restart after finalization'; END IF;
    END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;
-- Private membership is readable only by this guard. The writer marker is set
-- by owner-only functions; application roles receive no function/table grants.
CREATE TRIGGER shop1_v2_guard_request BEFORE INSERT OR UPDATE OR DELETE ON public.material_requests FOR EACH ROW EXECUTE FUNCTION shop1_v2.guard_managed();
CREATE TRIGGER shop1_v2_guard_card BEFORE INSERT OR UPDATE OR DELETE ON public.work_cards FOR EACH ROW EXECUTE FUNCTION shop1_v2.guard_managed();
REVOKE ALL ON ALL TABLES IN SCHEMA shop1_v2 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA shop1_v2 FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.shop1_v2_enroll(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.shop1_v2_reserve_sheets(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.shop1_v2_create_cards(uuid,text,jsonb) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.shop1_v2_complete_cutting(uuid,jsonb,text,text,integer,uuid,text) FROM PUBLIC, anon, authenticated, service_role;
COMMIT;
