-- rollout-contract: v1
-- risk: high
-- transaction: transactional
-- preflight: supabase/diagnostics/20261003191000_atomic_reception_and_stock_audit_preflight.sql
-- postcondition: supabase/diagnostics/20261003191000_atomic_reception_and_stock_audit_postcondition.sql
-- rollback: supabase/rollbacks/20261003191000_atomic_reception_and_stock_audit_rollback.sql
SET lock_timeout = '5s';
SET statement_timeout = '60s';
BEGIN;

-- Append-only audit includes every stock type, reservation, correction and identity change.
CREATE TABLE IF NOT EXISTS mes_private.factory_inventory_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 inventory_id uuid NOT NULL, actor_id uuid, transaction_id bigint NOT NULL,
 document_id text, action text NOT NULL, before_row jsonb, after_row jsonb,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON mes_private.factory_inventory_events FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION mes_private.audit_factory_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $audit$
BEGIN
 IF TG_OP='UPDATE' AND
   (to_jsonb(OLD)-'updated_at') IS NOT DISTINCT FROM (to_jsonb(NEW)-'updated_at') THEN RETURN NEW; END IF;
 INSERT INTO mes_private.factory_inventory_events(inventory_id,actor_id,transaction_id,document_id,action,before_row,after_row)
 VALUES(coalesce(NEW.id,OLD.id),auth.uid(),txid_current(),nullif(current_setting('app.accounting_document',true),''),TG_OP,
   CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$audit$;
REVOKE ALL ON FUNCTION mes_private.audit_factory_inventory() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER trg_factory_inventory_audit AFTER INSERT OR UPDATE OR DELETE ON public.inventory
FOR EACH ROW EXECUTE FUNCTION mes_private.audit_factory_inventory();

CREATE OR REPLACE FUNCTION public.rpc_confirm_reception_atomic(
 p_doc_id uuid,p_actual_items jsonb DEFAULT '[]'::jsonb,p_note text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $reception$
DECLARE
 doc public.reception_docs%rowtype; item jsonb; actual jsonb; completed jsonb:='[]';
 nom public.nomenclatures_v2%rowtype; source_row public.inventory%rowtype; target_row public.inventory%rowtype;
 nom_id uuid; item_name text; target_wh text; source_wh text; item_qty numeric; expected_qty numeric;
 item_index integer; item_record record; target_id uuid; discrepancy numeric; act_num text;
BEGIN
 IF auth.uid() IS NULL OR public.mes_current_system_user_id() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
 IF p_actual_items IS NULL OR jsonb_typeof(p_actual_items)<>'array' THEN RAISE EXCEPTION 'Expected actual items array'; END IF;
 SELECT * INTO doc FROM public.reception_docs WHERE id=p_doc_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Reception document not found'; END IF;
 IF doc.status='completed' THEN RETURN jsonb_build_object('success',true,'already_completed',true); END IF;
 IF doc.status='in-progress' THEN RAISE EXCEPTION 'Document locked by previous workflow; reconcile before retry'; END IF;
 IF jsonb_typeof(coalesce(doc.items,'[]'::jsonb))<>'array' THEN RAISE EXCEPTION 'Invalid document items'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_actual_items) WITH ORDINALITY a(value,n)
   WHERE coalesce((value->>'index')::integer,n::integer-1)<0 OR coalesce((value->>'index')::integer,n::integer-1)>=jsonb_array_length(coalesce(doc.items,'[]'))) THEN
   RAISE EXCEPTION 'Actual item index outside document'; END IF;
 IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_actual_items) WITH ORDINALITY a(value,n)
   GROUP BY coalesce((value->>'index')::integer,n::integer-1) HAVING count(*)>1) THEN RAISE EXCEPTION 'Duplicate actual item index'; END IF;
 target_wh:=coalesce(nullif(doc.target_warehouse,''),'production'); source_wh:=nullif(doc.source_warehouse,'');
 IF source_wh=target_wh THEN RAISE EXCEPTION 'Source and destination warehouses are equal'; END IF;
 act_num:='ACT-'||to_char(current_date,'YYYYMMDD')||'-'||upper(left(p_doc_id::text,6));
 PERFORM set_config('app.accounting_document',p_doc_id::text,true);
 -- Serialize reception commands; row locks still protect against other stock writers.
 PERFORM pg_advisory_xact_lock(hashtextextended('factory-reception',0));
 FOR item_record IN SELECT value,ordinality FROM jsonb_array_elements(coalesce(doc.items,'[]')) WITH ORDINALITY LOOP
   item:=item_record.value; item_index:=item_record.ordinality-1;
   SELECT value INTO actual FROM jsonb_array_elements(p_actual_items) WITH ORDINALITY a(value,n)
     WHERE coalesce((value->>'index')::integer,n::integer-1)=item_index;
   expected_qty:=coalesce((item->>'expected_qty')::numeric,(item->>'qty')::numeric,(item->>'missingAmount')::numeric,(item->>'quantity')::numeric,(item->>'needed')::numeric,0);
   item_qty:=CASE WHEN actual IS NULL THEN expected_qty ELSE coalesce((actual->>'actual_qty')::numeric,(actual->>'qty')::numeric,(actual->>'received_qty')::numeric,0) END;
   IF item_qty<0 OR expected_qty<0 OR item_qty::text IN ('NaN','Infinity','-Infinity') OR expected_qty::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid receipt quantity'; END IF;
   discrepancy:=item_qty-expected_qty;
   completed:=completed||jsonb_build_array(item||jsonb_build_object('expected_qty',expected_qty,'actual_qty',item_qty,'accepted_qty',item_qty,
     'discrepancy_qty',discrepancy,'discrepancy_type',CASE WHEN discrepancy<0 THEN 'shortage' WHEN discrepancy>0 THEN 'surplus' ELSE 'matched' END,
     'discrepancy_note',coalesce(actual->>'note',''),'discrepancy_act',CASE WHEN discrepancy<>0 THEN jsonb_build_object(
       'act_num',act_num,'created_at',now(),'target_warehouse',target_wh,'source_warehouse',source_wh,
       'expected_qty',expected_qty,'actual_qty',item_qty,'discrepancy_qty',discrepancy,
       'reason',coalesce(nullif(actual->>'note',''),p_note,'Фактична кількість не збігається з документом прийомки')) ELSE NULL END));
   IF item_qty=0 THEN CONTINUE; END IF;
   nom_id:=nullif(item->>'nomenclature_id','')::uuid;
   item_name:=coalesce(item->>'name',item->>'reqDetails',item->>'details','');
   SELECT * INTO nom FROM public.nomenclatures_v2 WHERE id=nom_id;
   -- Never move another nomenclature merely because it shares the same name.
   IF source_wh IS NOT NULL THEN
     SELECT * INTO source_row FROM public.inventory i WHERE i.warehouse=source_wh AND i.pocket_owner IS NULL
       AND ((nom_id IS NOT NULL AND i.nomenclature_id=nom_id) OR
         (i.nomenclature_id IS NULL AND lower(btrim(i.name))=lower(btrim(item_name))))
       ORDER BY (i.id::text=coalesce(item->>'inventory_id','')) DESC,i.total_qty DESC,i.id LIMIT 1 FOR UPDATE;
     IF NOT FOUND OR source_row.total_qty IS NULL OR source_row.total_qty<item_qty THEN RAISE EXCEPTION 'Insufficient source stock for %',item_name; END IF;
     UPDATE public.inventory SET total_qty=total_qty-item_qty,reserved_qty=greatest(0,coalesce(reserved_qty,0)-item_qty),updated_at=now() WHERE id=source_row.id;
   END IF;
   SELECT * INTO target_row FROM public.inventory i WHERE i.warehouse=target_wh AND i.pocket_owner IS NOT DISTINCT FROM doc.pocket_owner
     AND ((nom_id IS NOT NULL AND i.nomenclature_id=nom_id) OR
       (i.nomenclature_id IS NULL AND lower(btrim(i.name))=lower(btrim(item_name))))
     ORDER BY (i.nomenclature_id=nom_id) DESC,i.total_qty DESC,i.id LIMIT 1 FOR UPDATE;
   IF FOUND THEN
     UPDATE public.inventory SET total_qty=coalesce(total_qty,0)+item_qty,nomenclature_id=coalesce(nomenclature_id,nom_id),updated_at=now() WHERE id=target_row.id;
   ELSE
     INSERT INTO public.inventory(nomenclature_id,name,total_qty,reserved_qty,type,warehouse,unit,pocket_owner)
     VALUES(nom_id,coalesce(nom.name,nullif(item_name,''),'Прийнята позиція'),item_qty,0,coalesce(nom.type,'raw'),target_wh,coalesce(nom.unit,'шт'),doc.pocket_owner);
   END IF;
 END LOOP;
 UPDATE public.reception_docs SET status='completed',items=completed WHERE id=p_doc_id;
 IF doc.task_id IS NOT NULL OR doc.order_id IS NOT NULL THEN
   UPDATE public.purchase_requests SET status='completed'
   WHERE destination_warehouse=CASE target_wh WHEN 'production' THEN 'procurement' WHEN 'operational' THEN 'production' ELSE NULL END
     AND ((doc.task_id IS NOT NULL AND task_id=doc.task_id) OR (doc.task_id IS NULL AND order_id=doc.order_id));
 END IF;
 RETURN jsonb_build_object('success',true,'doc_id',p_doc_id,'items',completed);
END;
$reception$;
REVOKE ALL ON FUNCTION public.rpc_confirm_reception_atomic(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_confirm_reception_atomic(uuid,jsonb,text) TO authenticated,service_role;
COMMIT;
