import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
let url = process.env.VITE_SUPABASE_URL
if (url?.includes('brandzilla-com-ua.workers.dev')) url='https://hurzutjytlcvtbvihnry.supabase.co'
const client = createClient(url, process.env.VITE_SUPABASE_ANON_KEY, {auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(url,options)=>fetch(url,{...options,signal:AbortSignal.timeout(20000)})}})
const out = {at:new Date().toISOString(),mode:'REST SELECT only; audit account subject to RLS; not a consistent database snapshot',checks:{}}
try {
 const {data,error}=await client.auth.signInWithPassword({email:process.env.AUDIT_EMAIL,password:process.env.AUDIT_PASSWORD})
 if(error) throw error
 out.authenticated=Boolean(data.session)
 for(const [table,columns] of [
   ['inventory','id,nomenclature_id,type,warehouse,pocket_owner,total_qty,reserved_qty'],
   ['material_requests','id,inventory_id,task_id,status,quantity'],
   ['work_cards','id,task_id,nomenclature_id,status,quantity']
 ]) {
   let rows=[], expected=null, complete=false
   for(let offset=0; offset<20000;offset+=500) {
     const {data,error,count}=await client.from(table).select(columns,{count:'exact'}).order('id').range(offset,offset+499)
     if(error) {out.checks[table]={errorCode:error.code,message:error.message};break}
     expected=count;rows.push(...data)
     if(rows.length>=count||data.length===0){complete=rows.length===count;break}
   }
   if(out.checks[table]?.errorCode)continue
   const summary={visibleRows:rows.length,expected,complete}
   if(table==='inventory') {
     summary.negativeTotal=rows.filter(r=>r.total_qty<0).length
     summary.negativeReserve=rows.filter(r=>r.reserved_qty<0).length
     summary.overReserved=rows.filter(r=>Number(r.reserved_qty)>Number(r.total_qty)).length
     summary.nullQuantities=rows.filter(r=>r.total_qty===null||r.reserved_qty===null).length
     summary.missingNomenclature=rows.filter(r=>!r.nomenclature_id).length
     const groups=new Map()
     for(const r of rows){const key=JSON.stringify([r.nomenclature_id,r.type,r.warehouse,r.pocket_owner]);groups.set(key,(groups.get(key)||0)+1)}
     summary.duplicateIdentityGroups=[...groups.values()].filter(n=>n>1).length
     summary.byWarehouseType={}
     for(const r of rows){const key=JSON.stringify([r.warehouse,r.type]);const s=summary.byWarehouseType[key]??={rows:0,overReserved:0};s.rows++;s.overReserved+=Number(Number(r.reserved_qty)>Number(r.total_qty))}
   } else {
     summary.negativeQty=rows.filter(r=>r.quantity<0).length
     summary.byStatus={}
     for(const r of rows)summary.byStatus[r.status]=(summary.byStatus[r.status]||0)+1
   }
   out.checks[table]=summary
 }
}catch(e){out.error={name:e.name,message:e.message}}
finally{await client.auth.signOut({scope:'local'}).catch(()=>{})}
fs.writeFileSync('docs/audits/factory-data-api-2026-10-03.json',JSON.stringify(out,null,2))
console.log(JSON.stringify(out,null,2))
