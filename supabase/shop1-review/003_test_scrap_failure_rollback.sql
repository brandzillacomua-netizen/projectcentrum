-- TEST ONLY, after installation of 001. Everything is rolled back.
-- Uses an existing nomenclature ID as a reference; never changes that nomenclature
-- or existing stock. Creates its own task, sheet stock and scrap stock.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
UPDATE shop1_v2.settings SET accept_new_tasks=true,completion_enabled=true WHERE id;
DO $$
DECLARE v_nom uuid; v_task uuid; v_sheet uuid; v_scrap uuid; v_req uuid;
  v_card uuid; v_full_card uuid; v_cards jsonb; v_failed boolean:=false;
BEGIN
  SELECT n.id INTO v_nom FROM public.nomenclatures_v2 n
  WHERE NOT EXISTS(SELECT 1 FROM public.inventory i WHERE i.nomenclature_id=n.id
    AND coalesce(i.type,'standard')='scrap_ready' AND coalesce(i.warehouse,'main')='operational'
    AND coalesce(i.pocket_owner,'none')='none') ORDER BY n.id LIMIT 1;
  IF v_nom IS NULL THEN RAISE EXCEPTION 'No isolated scrap fixture possible: need one nomenclature without operational scrap stock'; END IF;
  INSERT INTO public.tasks(step,warehouse_conf,engineer_conf,director_conf)
    VALUES('SHOP1 V2 SCRAP TEST','false',true,true) RETURNING id INTO v_task;
  INSERT INTO public.inventory(name,unit,warehouse,total_qty,reserved_qty)
    VALUES('V2 SHEET '||v_task,'л','operational',30,0) RETURNING id INTO v_sheet;
  INSERT INTO public.inventory(name,unit,warehouse,type,nomenclature_id,total_qty,reserved_qty)
    VALUES('V2 SCRAP '||v_task,'шт','operational','scrap_ready',v_nom,0,0) RETURNING id INTO v_scrap;
  INSERT INTO public.material_requests(task_id,inventory_id,quantity,status,category,target_warehouse)
    VALUES(v_task,v_sheet,15,'pending','sheet','operational') RETURNING id INTO v_req;
  PERFORM public.shop1_v2_reserve_sheets(v_task);
  v_cards:=public.shop1_v2_create_cards(v_task,'scrap-test',jsonb_build_array(jsonb_build_object(
    'nomenclature_id',v_nom,'quantity',6,'allocations',jsonb_build_array(jsonb_build_object('request_id',v_req,'kind','sheet','planned_qty',3)))));
  v_card:=(v_cards->>0)::uuid;
  UPDATE public.work_cards SET status='in-progress',started_at=now() WHERE id=v_card;

  -- Inject a failure at the ledger INSERT, after stock/card/history/scrap writes.
  -- Constraint touches only the private candidate ledger and this synthetic card.
  EXECUTE format('ALTER TABLE shop1_v2.movements ADD CONSTRAINT shop1_trial_failure CHECK(card_id<>%L::uuid) NOT VALID',v_card);
  BEGIN
    PERFORM public.shop1_v2_complete_cutting(v_card,'{}','TEST','TEST',2,v_scrap,'OTHER TEST');
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%shop1_trial_failure%' THEN RAISE; END IF;
    v_failed:=true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL: injected ledger error was ignored'; END IF;
  IF EXISTS(SELECT 1 FROM public.inventory WHERE id=v_sheet AND (total_qty<>30 OR reserved_qty<>15))
    OR EXISTS(SELECT 1 FROM public.inventory WHERE id=v_scrap AND total_qty<>0)
    OR EXISTS(SELECT 1 FROM public.work_cards WHERE id=v_card AND (status<>'in-progress' OR quantity<>6))
    OR EXISTS(SELECT 1 FROM public.work_card_history WHERE card_id=v_card)
    OR EXISTS(SELECT 1 FROM shop1_v2.completions WHERE card_id=v_card)
    OR EXISTS(SELECT 1 FROM shop1_v2.scrap_movements WHERE card_id=v_card) THEN
    RAISE EXCEPTION 'FAIL: transaction did not roll back completely';
  END IF;
  ALTER TABLE shop1_v2.movements DROP CONSTRAINT shop1_trial_failure;
  PERFORM public.shop1_v2_complete_cutting(v_card,'{}','TEST','TEST',2,v_scrap,'OTHER TEST');
  PERFORM public.shop1_v2_complete_cutting(v_card,'{}','TEST','TEST',2,v_scrap,'OTHER TEST');
  IF (SELECT total_qty FROM public.inventory WHERE id=v_sheet)<>27
    OR (SELECT reserved_qty FROM public.inventory WHERE id=v_sheet)<>12
    OR (SELECT total_qty FROM public.inventory WHERE id=v_scrap)<>2
    OR (SELECT quantity FROM public.work_cards WHERE id=v_card)<>4
    OR (SELECT count(*) FROM public.work_card_history WHERE card_id=v_card)<>2 THEN RAISE EXCEPTION 'FAIL: partial scrap/replay'; END IF;

  v_cards:=public.shop1_v2_create_cards(v_task,'full-scrap-test',jsonb_build_array(jsonb_build_object(
    'nomenclature_id',v_nom,'quantity',6,'allocations',jsonb_build_array(jsonb_build_object('request_id',v_req,'kind','sheet','planned_qty',3)))));
  v_full_card:=(v_cards->>0)::uuid;
  UPDATE public.work_cards SET status='in-progress',started_at=now() WHERE id=v_full_card;
  PERFORM public.shop1_v2_complete_cutting(v_full_card,'{}','TEST','TEST',6,v_scrap);
  PERFORM public.shop1_v2_complete_cutting(v_full_card,'{}','TEST','TEST',6,v_scrap);
  IF (SELECT total_qty FROM public.inventory WHERE id=v_sheet)<>24
    OR (SELECT reserved_qty FROM public.inventory WHERE id=v_sheet)<>9
    OR (SELECT total_qty FROM public.inventory WHERE id=v_scrap)<>8
    OR (SELECT quantity FROM public.work_cards WHERE id=v_full_card)<>0 THEN RAISE EXCEPTION 'FAIL: full scrap/replay'; END IF;
END;
$$;
SELECT jsonb_build_object('scope','TEST synthetic scrap and failure','result','PASS',
  'checks',jsonb_build_array('late failure rolls back stock/card/history/ledger/scrap','partial scrap','separate scrap operator','full scrap','retry without double consumption'),
  'data_changes','rolled back by final ROLLBACK',
  'not_covered','concurrent sessions, browser permissions, cutter restoration') AS shop1_v2_scrap_smoke;
ROLLBACK;
