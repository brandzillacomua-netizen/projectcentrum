import fs from 'node:fs'
import assert from 'node:assert/strict'
import { PGlite } from './factory-db-test/node_modules/@electric-sql/pglite/dist/index.js'
const db=new PGlite()
const results=[]
const sql=async s=>(await db.query(s)).rows
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA mes_private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
CREATE FUNCTION public.mes_current_system_user_id() RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT CASE WHEN auth.uid() IS NOT NULL THEN 1::bigint END $$;
SELECT set_config('test.actor','11111111-1111-1111-1111-111111111111',false);
CREATE TABLE nomenclatures_v2(id uuid PRIMARY KEY,name text,unit text,type text);
CREATE TABLE nomenclatures(LIKE nomenclatures_v2 INCLUDING ALL);
CREATE TABLE inventory(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),nomenclature_id uuid,name text,unit text,type text,warehouse text,pocket_owner text,total_qty numeric DEFAULT 0,reserved_qty numeric DEFAULT 0,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),
CONSTRAINT inventory_name_type_warehouse_owner_unique UNIQUE NULLS NOT DISTINCT(name,type,warehouse,pocket_owner));
CREATE TABLE tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text,completed_at timestamptz,order_id uuid,step text,batch_index integer,plan_snapshot jsonb);
CREATE TABLE work_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid,order_id uuid,nomenclature_id uuid,quantity numeric,status text,operation text,card_info text,buffer_qty numeric,used_in_shop2_qty numeric,started_at timestamptz,completed_at timestamptz,updated_at timestamptz);
CREATE TABLE work_card_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),card_id uuid,task_id uuid,nomenclature_id uuid,stage_name text,operator_name text,card_info text,qty_at_start numeric,qty_completed numeric,scrap_qty numeric,started_at timestamptz,completed_at timestamptz,created_at timestamptz,shift_name text,manager_name text,machine_name text,machine text,is_archived_scrap boolean);
CREATE TABLE reception_docs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),doc_num text,type text,status text,order_id uuid,task_id uuid,details text,items jsonb,target_warehouse text,source_warehouse text,pocket_owner text);
CREATE TABLE purchase_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),status text,destination_warehouse text,task_id uuid,order_id uuid);
CREATE TABLE vkya_restoration_cards(id uuid PRIMARY KEY);
CREATE TABLE inventory_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE TABLE vkya_quality_resolutions(id uuid PRIMARY KEY);
`)
const definitions=[
 ['20260906141000_atomic_inventory_and_scrap_rpcs.sql',['rpc_deduct_inventory_atomic','rpc_qc_scrap_atomic']],
 ['20260918150000_rpc_reserve_material_atomic.sql',['rpc_reserve_material_atomic']],
 ['20260922122000_migrate_bz_to_sgp_and_update_rpc.sql',['rpc_increment_inventory_stock']],
 ['20260918000002_rpc_sorting_completion_atomic.sql',['rpc_submit_sorting_complete_atomic']],
 ['20260918000000_rpc_single_factory_handovers_atomic.sql',['rpc_handover_to_sgp_atomic','rpc_handover_task_to_shop2_atomic']],
 ['20260925140000_fix_vkya_restoration_return_resilience.sql',['vkya_add_route_inventory','return_legacy_restoration_to_bz','return_vkya_restoration_to_route']]
]
for(const [file,names] of definitions)for(const name of names){
 const source=fs.readFileSync('supabase/migrations/'+file,'utf8')
 const start=source.search(new RegExp('create or replace function (?:public\\.)?'+name+'\\(','i'))
 const tail=source.slice(start),tag=tail.match(/\bas\s+(\$[\w]*\$)/i)[1],bodyStart=tail.indexOf(tag),end=tail.indexOf(tag,bodyStart+tag.length)
 await db.exec(tail.slice(0,end+tag.length+1))
}
for(const file of ['20261003190000_factory_accounting_guards.sql','20261003191000_atomic_reception_and_stock_audit.sql'])await db.exec(fs.readFileSync('supabase/migrations/'+file,'utf8'))
const nom='22222222-2222-2222-2222-222222222222', inv='33333333-3333-3333-3333-333333333333',card='44444444-4444-4444-4444-444444444444'
await db.exec(`INSERT INTO nomenclatures_v2 VALUES('${nom}','Part','шт','part'); INSERT INTO nomenclatures SELECT * FROM nomenclatures_v2;
INSERT INTO inventory(id,nomenclature_id,name,unit,type,warehouse,total_qty,reserved_qty) VALUES('${inv}','${nom}','Part','шт','raw','production',10,4);
INSERT INTO work_cards(id,nomenclature_id,quantity,status,operation,card_info) VALUES('${card}','${nom}',10,'in-progress','Сортування','[NEED:10]');`)
async function check(name,fn){try{await fn();results.push({name,passed:true})}catch(e){results.push({name,passed:false,error:e.message});throw e}}
try{
await check('deduction rejects shortage and leaves both quantities unchanged',async()=>{
 await assert.rejects(()=>sql(`SELECT rpc_deduct_inventory_atomic('${inv}',11,0)`),/Insufficient/)
 assert.deepEqual(await sql(`SELECT total_qty::text,reserved_qty::text FROM inventory WHERE id='${inv}'`),[{total_qty:'10',reserved_qty:'4'}])
})
await check('deduction rejects negative and NaN parameters',async()=>{
 await assert.rejects(()=>sql(`SELECT rpc_deduct_inventory_atomic('${inv}',-1,0)`),/Invalid/)
 await assert.rejects(()=>sql(`SELECT rpc_deduct_inventory_atomic('${inv}','NaN',0)`),/Invalid/)
})
await check('valid deduction preserves the deployed response and quantities',async()=>{
 const [r]=await sql(`SELECT rpc_deduct_inventory_atomic('${inv}',2,1) AS result`)
 assert.equal(r.result.success,true);assert.equal(r.result.new_total,8);assert.equal(r.result.new_reserved,3)
})
await check('reservation replay is applied once and changed payload is rejected',async()=>{
 await sql(`SELECT rpc_reserve_material_atomic('${inv}',2,'reserve','r1')`);await sql(`SELECT rpc_reserve_material_atomic('${inv}',2,'reserve','r1')`)
 assert.equal((await sql(`SELECT reserved_qty::text AS qty FROM inventory WHERE id='${inv}'`))[0].qty,'5')
 await assert.rejects(()=>sql(`SELECT rpc_reserve_material_atomic('${inv}',3,'reserve','r1')`),/different input/)
})
await check('QC scrap replay posts history and inventory once',async()=>{
 await sql(`SELECT rpc_qc_scrap_atomic('${card}',2,'{}','qc1')`);await sql(`SELECT rpc_qc_scrap_atomic('${card}',2,'{}','qc1')`)
 assert.equal((await sql(`SELECT quantity::text AS qty FROM work_cards WHERE id='${card}'`))[0].qty,'8')
 assert.equal((await sql(`SELECT count(*)::int AS n FROM work_card_history WHERE card_id='${card}'`))[0].n,1)
 assert.equal((await sql(`SELECT total_qty::text AS qty FROM inventory WHERE type='scrap_ready'`))[0].qty,'2')
})
await check('SGP shortage rolls back source, destination and card',async()=>{
 await db.exec(`INSERT INTO inventory(nomenclature_id,name,type,warehouse,total_qty) VALUES('${nom}','Part','semi_shop2','production',3)`)
 await assert.rejects(()=>sql(`SELECT rpc_handover_to_sgp_atomic('${card}')`),/Insufficient/)
 assert.equal((await sql(`SELECT total_qty::text AS qty FROM inventory WHERE type='semi_shop2'`))[0].qty,'3')
 assert.equal((await sql(`SELECT count(*)::int AS n FROM inventory WHERE warehouse='sgp'`))[0].n,0)
})
await check('sorting exact balance, shortage rollback, successful replay',async()=>{
 await assert.rejects(()=>sql(`SELECT rpc_submit_sorting_complete_atomic('${card}',9,0,0,'Tester','Day')`),/balance/)
 await assert.rejects(()=>sql(`SELECT rpc_submit_sorting_complete_atomic('${card}',8,0,0,'Tester','Day')`),/Insufficient/)
 await db.exec(`INSERT INTO inventory(nomenclature_id,name,type,warehouse,total_qty) VALUES('${nom}','Part','semi','production',8)`)
 await sql(`SELECT rpc_submit_sorting_complete_atomic('${card}',8,0,0,'Tester','Day')`)
 await sql(`SELECT rpc_submit_sorting_complete_atomic('${card}',8,0,0,'Tester','Day')`)
 assert.equal((await sql(`SELECT total_qty::text AS qty FROM inventory WHERE type='semi_shop2'`))[0].qty,'11')
 assert.equal((await sql(`SELECT count(*)::int AS n FROM work_card_history WHERE stage_name='Сортування'`))[0].n,1)
})
await check('increment refuses same-name different-identity stock',async()=>{
 const other='55555555-5555-5555-5555-555555555555'
 await db.exec(`INSERT INTO nomenclatures_v2 VALUES('${other}','Part','шт','part')`)
 await assert.rejects(()=>sql(`SELECT rpc_increment_inventory_stock('${other}',1,'raw','Part','шт','production')`),/another nomenclature/)
 assert.equal((await sql(`SELECT total_qty::text AS qty FROM inventory WHERE id='${inv}'`))[0].qty,'8')
})
await check('atomic reception preserves actual discrepancy and is idempotent',async()=>{
 const doc='66666666-6666-6666-6666-666666666666'
 await db.exec(`INSERT INTO reception_docs(id,status,items,target_warehouse,source_warehouse) VALUES('${doc}','shipped','[{"nomenclature_id":"${nom}","qty":5,"name":"Part"}]','operational','production')`)
 await sql(`SELECT rpc_confirm_reception_atomic('${doc}','[{"index":0,"actual_qty":3,"note":"short"}]',null)`)
 await sql(`SELECT rpc_confirm_reception_atomic('${doc}','[{"index":0,"actual_qty":3}]',null)`)
 assert.equal((await sql(`SELECT total_qty::text AS qty FROM inventory WHERE id='${inv}'`))[0].qty,'5')
 const [r]=await sql(`SELECT status,items FROM reception_docs WHERE id='${doc}'`)
 assert.equal(r.status,'completed');assert.equal(r.items[0].discrepancy_qty,-2)
 assert.equal((await sql(`SELECT total_qty::text AS qty FROM inventory WHERE type='part' AND warehouse='operational'`))[0].qty,'3')
})
await check('reception rolls back earlier items on later shortage, including audit writes',async()=>{
 const doc='77777777-7777-7777-7777-777777777777'
 await db.exec(`INSERT INTO reception_docs(id,status,items,target_warehouse,source_warehouse) VALUES('${doc}','shipped','[{"nomenclature_id":"${nom}","qty":1,"name":"Part"},{"nomenclature_id":"${nom}","qty":100,"name":"Part"}]','operational','production')`)
 const [before]=await sql(`SELECT count(*)::int AS n FROM mes_private.factory_inventory_events`)
 await assert.rejects(()=>sql(`SELECT rpc_confirm_reception_atomic('${doc}')`),/Insufficient/)
 assert.equal((await sql(`SELECT total_qty::text AS qty FROM inventory WHERE id='${inv}'`))[0].qty,'5')
 assert.equal((await sql(`SELECT status FROM reception_docs WHERE id='${doc}'`))[0].status,'shipped')
 assert.equal((await sql(`SELECT count(*)::int AS n FROM mes_private.factory_inventory_events`))[0].n,before.n)
})
await check('anonymous ACL and missing identity reject accounting mutations',async()=>{
 assert.equal((await sql(`SELECT has_function_privilege('anon','public.vkya_add_route_inventory(uuid,text,integer)','EXECUTE') AS allowed`))[0].allowed,false)
 await sql(`SELECT set_config('test.actor','',false)`)
 await assert.rejects(()=>sql(`SELECT rpc_deduct_inventory_atomic('${inv}',1,0)`),/Authentication/)
 await sql(`SELECT set_config('test.actor','11111111-1111-1111-1111-111111111111',false)`)
})
await check('rollback restores saved function bodies without erasing audit evidence',async()=>{
 await db.exec(fs.readFileSync('supabase/rollbacks/20261003191000_atomic_reception_and_stock_audit_rollback.sql','utf8'))
 await db.exec(fs.readFileSync('supabase/rollbacks/20261003190000_factory_accounting_guards_rollback.sql','utf8'))
 assert.equal((await sql(`SELECT to_regprocedure('public.rpc_confirm_reception_atomic(uuid,jsonb,text)') IS NULL AS removed`))[0].removed,true)
 assert.ok((await sql(`SELECT count(*)::int AS n FROM mes_private.factory_inventory_events`))[0].n>0)
 assert.equal((await sql(`SELECT has_function_privilege('anon','public.vkya_add_route_inventory(uuid,text,integer)','EXECUTE') AS allowed`))[0].allowed,false)
})
}finally{
 fs.writeFileSync('docs/audits/factory-fixes-postgres-test-2026-10-03.json',JSON.stringify({at:new Date().toISOString(),engine:'PGlite PostgreSQL; isolated minimal schema fixture, not production schema parity',results},null,2))
 console.log(JSON.stringify(results,null,2));await db.close()
}
