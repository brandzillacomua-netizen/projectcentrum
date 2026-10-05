import fs from 'node:fs'
const base='20261003190000_factory_accounting_guards'
const read=p=>fs.readFileSync('supabase/migrations/'+p,'utf8')
function definition(file,name){
 const source=read(file)
 const start=source.search(new RegExp('create or replace function (?:public\\.)?'+name+'\\(','i'))
 if(start<0)throw new Error(name)
 const tail=source.slice(start);const tag=tail.match(/\bas\s+(\$[\w]*\$)/i)?.[1]
 const bodyStart=tail.indexOf(tag);const end=tail.indexOf(tag,bodyStart+tag.length)
 return tail.slice(0,end+tag.length+1)
}
const auth=`
  IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN
    RAISE EXCEPTION 'Authentication required or MES profile is not linked' USING ERRCODE = '42501';
  END IF;
`
let deduct=definition('20260906141000_atomic_inventory_and_scrap_rpcs.sql','rpc_deduct_inventory_atomic')
deduct=deduct.replace('SECURITY DEFINER','SECURITY DEFINER\nSET search_path = pg_catalog, public').replace('BEGIN',`BEGIN${auth}
  IF p_deduct_total IS NULL OR p_release_reserved IS NULL OR
     p_deduct_total::text IN ('NaN','Infinity','-Infinity') OR p_release_reserved::text IN ('NaN','Infinity','-Infinity') OR
     p_deduct_total < 0 OR p_release_reserved < 0 THEN
    RAISE EXCEPTION 'Invalid deduction quantity' USING ERRCODE = '22023';
  END IF;`)
deduct=deduct.replace('  v_new_total := GREATEST',`  IF p_deduct_total > coalesce(v_inv.total_qty,0) THEN
    RAISE EXCEPTION 'Insufficient stock: available %, requested %', v_inv.total_qty, p_deduct_total USING ERRCODE = 'P0001';
  END IF;
  v_new_total := GREATEST`)
// Reservation receipts are independent of browser retries and committed with the update.
let reserve=definition('20260918150000_rpc_reserve_material_atomic.sql','rpc_reserve_material_atomic')
reserve=reserve.replace('  v_inv record;',`  v_inv record;
  v_payload jsonb := jsonb_build_object('inventory_id',p_inventory_id,'qty',p_qty,'action',p_action);
  v_receipt record;
  v_result jsonb;`)
reserve=reserve.replace('BEGIN',`BEGIN${auth}
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
  END IF;`)
reserve=reserve.replace("  ELSIF p_action = 'deduct' THEN",`  ELSIF p_action = 'deduct' THEN
    IF p_qty > coalesce(v_inv.total_qty,0) THEN RAISE EXCEPTION 'Insufficient stock'; END IF;`)
reserve=reserve.replace('v_inv.reserved_qty + p_qty','coalesce(v_inv.reserved_qty,0) + p_qty').replace('RETURN jsonb_build_object(', 'v_result := jsonb_build_object(')
reserve=reserve.replace('END;\n$body$;',`  IF nullif(p_idempotency_key,'') IS NOT NULL THEN
    INSERT INTO mes_private.accounting_receipts(operation,operation_key,payload,result) VALUES ('reserve',p_idempotency_key,v_payload,v_result);
  END IF;
  RETURN v_result;
END;
$body$;`)
let increment=definition('20260922122000_migrate_bz_to_sgp_and_update_rpc.sql','rpc_increment_inventory_stock')
increment=increment.replace('\nbegin\n',`\nbegin\n${auth}`)
increment=increment.replace('p_qty is null or p_qty <= 0',"p_qty is null or p_qty::text in ('NaN','Infinity','-Infinity') or p_qty <= 0")
increment=increment.replace('or lower(btrim(i.name)) = lower(v_nom_name)', 'or (i.nomenclature_id is null and lower(btrim(i.name)) = lower(v_nom_name))')
// A name-based UNIQUE conflict may only adopt an unlinked row or the same identity.
increment=increment.replace('  returning id, total_qty into v_inv_id, v_new_qty;',`  where public.inventory.nomenclature_id is null or public.inventory.nomenclature_id = excluded.nomenclature_id
  returning id, total_qty into v_inv_id, v_new_qty;
  if not found then raise exception 'Inventory name belongs to another nomenclature; reconcile identity before posting'; end if;`)
let qc=definition('20260906141000_atomic_inventory_and_scrap_rpcs.sql','rpc_qc_scrap_atomic')
qc=qc.replace('SECURITY DEFINER','SECURITY DEFINER\nSET search_path = pg_catalog, public')
qc=qc.replace('  v_final_card_info TEXT;',`  v_final_card_info TEXT;
  v_receipt record;
  v_payload jsonb := jsonb_build_object('card_id',p_card_id,'qty',p_scrap_qty,'history',p_history_data);
  v_result jsonb;`)
qc=qc.replace('BEGIN',`BEGIN${auth}
  IF p_scrap_qty IS NULL OR p_scrap_qty::text IN ('NaN','Infinity','-Infinity') OR p_scrap_qty <= 0 THEN
    RAISE EXCEPTION 'Invalid scrap quantity' USING ERRCODE = '22023';
  END IF;
  IF nullif(p_idempotency_key,'') IS NULL THEN RAISE EXCEPTION 'Scrap operation requires an idempotency key'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('qc:' || p_idempotency_key,0));
  SELECT * INTO v_receipt FROM mes_private.accounting_receipts WHERE operation='qc' AND operation_key=p_idempotency_key;
  IF FOUND THEN
    IF v_receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Idempotency key reused with different input'; END IF;
    RETURN v_receipt.result || jsonb_build_object('already_processed',true,'reason','idempotent_replay');
  END IF;`)
qc=qc.replace('  v_new_qty := GREATEST',`  IF p_scrap_qty > coalesce(v_current_card.quantity,0) THEN RAISE EXCEPTION 'Scrap exceeds card quantity'; END IF;
  v_new_qty := GREATEST`)
qc=qc.replace("  RETURN jsonb_build_object(\n    'success', true,", "  v_result := jsonb_build_object(\n    'success', true,")
qc=qc.replace('END;\n$$;',`  INSERT INTO mes_private.accounting_receipts(operation,operation_key,payload,result) VALUES ('qc',p_idempotency_key,v_payload,v_result);
  RETURN v_result;
END;
$$;`)
let sorting=definition('20260918000002_rpc_sorting_completion_atomic.sql','rpc_submit_sorting_complete_atomic')
sorting=sorting.replace('  v_arrivals jsonb;',`  v_arrivals jsonb;
  v_receipt record;
  v_payload jsonb := jsonb_build_object('good',p_good_qty,'scrap',p_scrap_qty,'rework',p_rework_qty);
  v_result jsonb;`)
sorting=sorting.replace('BEGIN',`BEGIN${auth}
  IF p_good_qty IS NULL OR p_scrap_qty IS NULL OR p_rework_qty IS NULL OR
    p_good_qty::text IN ('NaN','Infinity','-Infinity') OR p_scrap_qty::text IN ('NaN','Infinity','-Infinity') OR
    p_rework_qty::text IN ('NaN','Infinity','-Infinity') OR least(p_good_qty,p_scrap_qty,p_rework_qty)<0 THEN
    RAISE EXCEPTION 'Invalid sorting quantities';
  END IF;`)
sorting=sorting.replace('  v_nom_id := v_card.nomenclature_id;',`  SELECT * INTO v_receipt FROM mes_private.accounting_receipts WHERE operation='sorting' AND operation_key=p_card_id::text;
  IF FOUND THEN
    IF v_receipt.payload IS DISTINCT FROM v_payload THEN RAISE EXCEPTION 'Sorting already completed with different quantities'; END IF;
    RETURN v_receipt.result;
  END IF;
  IF v_card.status IN ('completed','at-shop2-buffer') THEN RAISE EXCEPTION 'Card already sorted; refresh its state'; END IF;
  IF p_good_qty+p_scrap_qty+p_rework_qty <> coalesce(v_card.quantity,0) THEN RAISE EXCEPTION 'Sorting quantities do not balance'; END IF;
  v_nom_id := v_card.nomenclature_id;`)
// Validate the source under the same transaction before any credit. Lock order is deterministic.
sorting=sorting.replace('  -- 1. Decrease Shop 1 semi inventory',`  PERFORM id FROM public.inventory WHERE nomenclature_id=v_nom_id AND type IN ('semi','wip_bz','bz') ORDER BY id FOR UPDATE;
  IF v_actual_need > coalesce((SELECT sum(total_qty) FROM public.inventory WHERE nomenclature_id=v_nom_id AND type='semi' AND (warehouse='production' OR warehouse IS NULL)),0) THEN RAISE EXCEPTION 'Insufficient Shop 1 semi stock'; END IF;
  IF v_actual_bz > coalesce((SELECT sum(total_qty) FROM public.inventory WHERE nomenclature_id=v_nom_id AND type IN ('wip_bz','bz')),0) THEN RAISE EXCEPTION 'Insufficient Shop 1 buffer stock'; END IF;
  -- 1. Decrease Shop 1 semi inventory`)
sorting=sorting.replace("  RETURN jsonb_build_object(\n", "  v_result := jsonb_build_object(\n")
sorting=sorting.replace('END;\n$body$;',`  INSERT INTO mes_private.accounting_receipts(operation,operation_key,payload,result) VALUES ('sorting',p_card_id::text,v_payload,v_result);
  RETURN v_result;
END;
$body$;`)
let sgp=definition('20260918000000_rpc_single_factory_handovers_atomic.sql','rpc_handover_to_sgp_atomic')
sgp=sgp.replace('BEGIN',`BEGIN${auth}`)
sgp=sgp.replace('  -- 2. Add finishedQty',`  IF v_rem_deduct > 0 THEN RAISE EXCEPTION 'Insufficient Shop 2 stock: missing %',v_rem_deduct; END IF;
  -- 2. Add finishedQty`)
sgp=sgp.replace('  v_finished_qty := v_total_qty;',`  IF v_total_qty <= 0 OR v_total_qty::text IN ('NaN','Infinity','-Infinity') OR v_nom_id IS NULL THEN RAISE EXCEPTION 'Invalid card quantity or nomenclature'; END IF;
  v_finished_qty := v_total_qty;`)
let shop2=definition('20260918000000_rpc_single_factory_handovers_atomic.sql','rpc_handover_task_to_shop2_atomic')
shop2=shop2.replace('BEGIN',`BEGIN${auth}`)
shop2=shop2.replace('          IF v_dec_semi > 0 THEN',`          PERFORM id FROM public.inventory WHERE nomenclature_id::text=v_nom_id AND type IN ('semi','wip_bz','bz') ORDER BY id FOR UPDATE;
          IF v_dec_semi > coalesce((SELECT sum(total_qty) FROM public.inventory WHERE nomenclature_id::text=v_nom_id AND type='semi' AND (warehouse='production' OR warehouse IS NULL)),0) THEN RAISE EXCEPTION 'Insufficient Shop 1 semi stock'; END IF;
          IF v_dec_wip > coalesce((SELECT sum(total_qty) FROM public.inventory WHERE nomenclature_id::text=v_nom_id AND type IN ('wip_bz','bz')),0) THEN RAISE EXCEPTION 'Insufficient Shop 1 buffer stock'; END IF;
          IF v_dec_semi > 0 THEN`)
// Consume exact deltas across legacy rows rather than subtracting the full amount from every row.
const consume=`CREATE OR REPLACE FUNCTION mes_private.consume_factory_stock(p_nom uuid,p_types text[],p_qty numeric,p_shop1_semi boolean DEFAULT false)
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
REVOKE ALL ON FUNCTION mes_private.consume_factory_stock(uuid,text[],numeric,boolean) FROM PUBLIC,anon,authenticated;`
let begin=sorting.indexOf('  PERFORM id FROM public.inventory');let end=sorting.indexOf('  -- 3. Increase Shop 2',begin)
sorting=sorting.slice(0,begin)+`  PERFORM mes_private.consume_factory_stock(v_nom_id,ARRAY['semi'],v_actual_need,true);
  PERFORM mes_private.consume_factory_stock(v_nom_id,ARRAY['wip_bz','bz'],v_actual_bz,false);
`+sorting.slice(end)
begin=shop2.indexOf('          PERFORM id FROM public.inventory');end=shop2.indexOf('        -- Increase Shop 2 stock',begin)
shop2=shop2.slice(0,begin)+`          PERFORM mes_private.consume_factory_stock(v_nom_id::uuid,ARRAY['semi'],v_dec_semi,true);
          PERFORM mes_private.consume_factory_stock(v_nom_id::uuid,ARRAY['wip_bz','bz'],v_dec_wip,false);
        END IF;

`+shop2.slice(end)
// Preserve existing VKYA behavior, adding authentication to the same signatures.
const vkya=['vkya_add_route_inventory','return_legacy_restoration_to_bz','return_vkya_restoration_to_route'].map(name=>
 definition('20260925140000_fix_vkya_restoration_return_resilience.sql',name).replace('\nbegin\n',`\nbegin\n${auth}`))
const functions=[consume,deduct,reserve,increment,qc,sorting,sgp,shop2,...vkya]
const signatures=[
 'public.rpc_deduct_inventory_atomic(uuid,numeric,numeric)',
 'public.rpc_reserve_material_atomic(uuid,numeric,text,text)',
 'public.rpc_increment_inventory_stock(uuid,numeric,text,text,text,text)',
 'public.rpc_qc_scrap_atomic(uuid,numeric,jsonb,text)',
 'public.rpc_submit_sorting_complete_atomic(uuid,numeric,numeric,numeric,text,text)',
 'public.rpc_handover_to_sgp_atomic(uuid)', 'public.rpc_handover_task_to_shop2_atomic(uuid)',
 'public.vkya_add_route_inventory(uuid,text,integer)','public.return_legacy_restoration_to_bz(uuid,text)','public.return_vkya_restoration_to_route(uuid,text)'
]
const list=signatures.map(s=>`'${s}'`).join(',\n')
const header=`-- rollout-contract: v1
-- risk: high
-- transaction: transactional
-- preflight: supabase/diagnostics/${base}_preflight.sql
-- postcondition: supabase/diagnostics/${base}_postcondition.sql
-- rollback: supabase/rollbacks/${base}_rollback.sql
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
  FOREACH sig IN ARRAY ARRAY[${list}] LOOP
    IF to_regprocedure(sig) IS NULL THEN RAISE EXCEPTION 'Missing required deployed function %',sig; END IF;
    INSERT INTO mes_private.accounting_function_backup SELECT '${base}',sig,pg_get_functiondef(to_regprocedure(sig)) ON CONFLICT DO NOTHING;
  END LOOP;
END;
$backup$;
`
let sql=header+functions.join('\n\n')+'\n'+signatures.map(s=>`REVOKE ALL ON FUNCTION ${s} FROM PUBLIC, anon;\nGRANT EXECUTE ON FUNCTION ${s} TO authenticated, service_role;`).join('\n')
sql+=`\nREVOKE ALL ON FUNCTION public.vkya_add_route_inventory(uuid,text,integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_legacy_restoration_to_bz(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.return_vkya_restoration_to_route(uuid,text) FROM PUBLIC, anon;
COMMIT;
`
fs.writeFileSync('supabase/migrations/'+base+'.sql',sql)
fs.writeFileSync('supabase/diagnostics/'+base+'_preflight.sql',`-- Read-only: every signature must resolve. Review production definitions before rollout.
SELECT signature, to_regprocedure(signature) IS NOT NULL AS installed FROM unnest(ARRAY[${list}]) AS signature;
SELECT count(*) FILTER (WHERE total_qty < 0 OR reserved_qty < 0 OR total_qty IS NULL) AS invalid_inventory,
 count(*) FILTER (WHERE reserved_qty > total_qty) AS over_reserved FROM public.inventory;
SELECT nomenclature_id,type,warehouse,count(*) FROM public.inventory WHERE nomenclature_id IS NOT NULL AND pocket_owner IS NULL GROUP BY nomenclature_id,type,warehouse HAVING count(*)>1;
`)
fs.writeFileSync('supabase/diagnostics/'+base+'_postcondition.sql',`-- Read-only installed ACL and receipt table checks.
SELECT signature, has_function_privilege('anon',to_regprocedure(signature),'EXECUTE') AS anon_execute FROM unnest(ARRAY[${list},'public.vkya_add_route_inventory(uuid,text,integer)','public.return_legacy_restoration_to_bz(uuid,text)','public.return_vkya_restoration_to_route(uuid,text)']) AS signature;
SELECT to_regclass('mes_private.accounting_receipts') IS NOT NULL AS receipts_installed;
`)
fs.writeFileSync('supabase/rollbacks/'+base+'_rollback.sql',`-- Restore previous function bodies only. Never reopen anonymous writes; retain receipts and audit evidence.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $restore$
DECLARE r record;
BEGIN
 IF (SELECT count(*) FROM mes_private.accounting_function_backup WHERE release='${base}')<>10 THEN RAISE EXCEPTION 'Incomplete function backup'; END IF;
 FOR r IN SELECT * FROM mes_private.accounting_function_backup WHERE release='${base}' LOOP EXECUTE r.definition; END LOOP;
END;
$restore$;
COMMIT;
`)
