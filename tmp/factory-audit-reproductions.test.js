// Audit demonstrations: PASS means the described defect was reproduced.
// All external writes are mocked. These are not acceptance tests for correctness.
import { expect, it, vi } from 'vitest'
const {rpc}=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('../src/supabase.js',()=>({supabase:{rpc},getCurrentTime:()=>new Date()}))
vi.mock('../src/services/sentryLogger.js',()=>({sentryLogger:{logException:vi.fn(),logWarning:vi.fn()}}))
vi.mock('react',()=>({useMemo:fn=>fn()}))
import { deductInventoryAtomic } from '../src/services/atomicInventoryService.js'
import { processOfflineMutation } from '../src/services/offlineProcessor.js'
import { useScrapReport } from '../src/modules/reports/hooks/useScrapReport.js'

it('REPRO: await deduction resolves on transport/database error, so unchecked callers continue',async()=>{
 const db={rpc:vi.fn().mockResolvedValue({data:null,error:{message:'simulated database failure'}})}
 let continued=false
 const result=await deductInventoryAtomic(db,{inventoryId:'audit-only',deductTotal:5})
 continued=true
 expect(result.success).toBe(false)
 expect(continued).toBe(true)
})
it('REPRO: offline QC server rejection is returned as top-level success',async()=>{
 rpc.mockResolvedValueOnce({data:{success:false,error:'Insufficient quantity'},error:null})
 const result=await processOfflineMutation({key:'audit-qc',actionType:'QC_SCRAP',payload:{cardId:'audit-only',scrapQty:10}})
 expect(result.success).toBe(true)
 expect(result.scrapResult.success).toBe(false)
})
it('REPRO: partial scrap classification makes report total 10 while its displayed rows sum to 3',()=>{
 const {scrapStats}=useScrapReport({
  workCardHistory:[{id:'h1',nomenclature_id:'n1',scrap_qty:10,operator_name:'Audit'}],
  scrapClassificationsList:[{id:'c1',nomenclature_id:'n1',quantity:3,source_operator_name:'Audit'}],
  scrapReasonsDb:[],classifiedHistoryIds:new Set(),nomenclatures:[{id:'n1',name:'Audit'}],
  filterByDate:()=>true,selectedShiftFilter:'all',selectedEmployeeFilter:'all',searchQuery:''
 })
 expect(scrapStats.totalScrap).toBe(10)
 expect(scrapStats.list.reduce((sum,row)=>sum+row.scrap_qty,0)).toBe(3)
})
