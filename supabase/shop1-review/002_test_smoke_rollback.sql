-- Run ONLY in the TEST SQL Editor, after 001_inventory_v2_candidate.sql.
-- Creates synthetic task/stock/cards in a transaction and rolls them ALL back.
-- Does not use existing production materials or orders. Application flags remain
-- disabled outside this transaction. Any assertion failure aborts the test.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
UPDATE shop1_v2.settings SET accept_new_tasks=true,completion_enabled=true WHERE id;
DO $$
DECLARE v_task uuid; v_stock uuid; v_req uuid; v_card uuid; v_next uuid; v_payload jsonb;
  v_ids jsonb; v_result jsonb; v_total numeric; v_reserved numeric; v_failed boolean:=false;
BEGIN
  INSERT INTO public.tasks(step,warehouse_conf,engineer_conf,director_conf)
  VALUES('SHOP1 V2 ROLLBACK TEST','false',false,false) RETURNING id INTO v_task;
  INSERT INTO public.inventory(name,unit,warehouse,total_qty,reserved_qty)
  VALUES('SHOP1 V2 TEST '||v_task,'л','operational',30,0) RETURNING id INTO v_stock;
  INSERT INTO public.material_requests(task_id,inventory_id,quantity,status,category,target_warehouse)
  VALUES(v_task,v_stock,15,'pending','sheet','operational') RETURNING id INTO v_req;
  PERFORM public.shop1_v2_reserve_sheets(v_task);
  PERFORM public.shop1_v2_reserve_sheets(v_task);
  SELECT total_qty,reserved_qty INTO v_total,v_reserved FROM public.inventory WHERE id=v_stock;
  IF v_total<>30 OR v_reserved<>15 THEN RAISE EXCEPTION 'FAIL: reserve must happen once without consumption'; END IF;
  v_payload:=jsonb_build_array(jsonb_build_object('quantity',6,'machine','TEST','allocations',jsonb_build_array(jsonb_build_object('request_id',v_req,'kind','sheet','planned_qty',3))));
  BEGIN
    PERFORM public.shop1_v2_create_cards(v_task,'first',v_payload);
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%Three full approvals%' THEN RAISE; END IF;
    v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: approvals bypassed'; END IF;
  UPDATE public.tasks SET engineer_conf=true,director_conf=true WHERE id=v_task;
  v_ids:=public.shop1_v2_create_cards(v_task,'first',v_payload);
  v_card:=(v_ids->>0)::uuid;
  IF public.shop1_v2_create_cards(v_task,'first',v_payload)<>v_ids THEN RAISE EXCEPTION 'FAIL: batch replay'; END IF;
  UPDATE public.work_cards SET status='in-progress',started_at=now() WHERE id=v_card;
  SELECT total_qty,reserved_qty INTO v_total,v_reserved FROM public.inventory WHERE id=v_stock;
  IF v_total<>30 OR v_reserved<>15 THEN RAISE EXCEPTION 'FAIL: start consumed stock'; END IF;
  v_result:=public.shop1_v2_complete_cutting(v_card,'{}','TEST','TEST');
  PERFORM public.shop1_v2_complete_cutting(v_card,'{}','TEST','TEST');
  SELECT total_qty,reserved_qty INTO v_total,v_reserved FROM public.inventory WHERE id=v_stock;
  IF v_total<>27 OR v_reserved<>12 THEN RAISE EXCEPTION 'FAIL: completion or replay'; END IF;
  IF (SELECT count(*) FROM shop1_v2.completions WHERE card_id=v_card)<>1 THEN RAISE EXCEPTION 'FAIL: duplicated completion'; END IF;
  UPDATE public.work_cards SET operation='Галтовка',status='in-progress' WHERE id=v_card;
  PERFORM public.shop1_v2_complete_cutting(v_card,'{}','TEST','TEST');
  SELECT total_qty,reserved_qty INTO v_total,v_reserved FROM public.inventory WHERE id=v_stock;
  IF v_total<>27 OR v_reserved<>12 THEN RAISE EXCEPTION 'FAIL: later stage changed stock'; END IF;
  v_payload:=jsonb_build_array(jsonb_build_object('quantity',24,'machine','TEST','allocations',jsonb_build_array(jsonb_build_object('request_id',v_req,'kind','sheet','planned_qty',12))));
  v_ids:=public.shop1_v2_create_cards(v_task,'remaining',v_payload);
  v_next:=(v_ids->>0)::uuid;
  UPDATE public.work_cards SET status='in-progress',started_at=now() WHERE id=v_next;
  PERFORM public.shop1_v2_complete_cutting(v_next,'{}','TEST','TEST');
  SELECT total_qty,reserved_qty INTO v_total,v_reserved FROM public.inventory WHERE id=v_stock;
  IF v_total<>15 OR v_reserved<>0 THEN RAISE EXCEPTION 'FAIL: ungenerated batch reservation lost'; END IF;
END;
$$;
SELECT jsonb_build_object('scope','TEST synthetic sheets only','result','PASS',
  'checks',jsonb_build_array('reserve once','three approvals','batch replay','start without consumption','15-3=12','completion replay','later stage','remaining batch'),
  'data_changes','rolled back by final ROLLBACK','not_covered','concurrent sessions, browser permissions, cutter restoration, scrap') AS shop1_v2_smoke;
ROLLBACK;
