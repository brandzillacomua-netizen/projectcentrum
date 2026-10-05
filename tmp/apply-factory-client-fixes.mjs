import fs from 'node:fs'
function edit(path,fn){const old=fs.readFileSync(path,'utf8');const next=fn(old);if(old===next)throw new Error(`No edit ${path}`);fs.writeFileSync(path,next)}
edit('src/contexts/production/productionHandovers.js',s=>{
 s="import { confirmedRpc } from '../../services/confirmedRpc.js'\n"+s
 let start=s.indexOf('  const handoverTaskToShop2 =');let end=s.indexOf('  const cancelHandoverToShop2 =',start)
 s=s.slice(0,start)+`  const handoverTaskToShop2 = async (taskId) => {
    await confirmedRpc(supabase, 'rpc_handover_task_to_shop2_atomic', { p_task_id: taskId })
    // Keep the existing material workflow, but never conceal its failure.
    await deductIssuedMaterialsForTask(taskId)
    for (const table of ['inventory', 'tasks', 'reception_docs', 'material_requests']) refreshTable(table)
  }

`+s.slice(end)
 start=s.indexOf('  const handoverToSGP =');end=s.indexOf('  const reserveBZForTask =',start)
 return s.slice(0,start)+`  const handoverToSGP = async (cardId) => {
    try {
      await confirmedRpc(supabase, 'rpc_handover_to_sgp_atomic', { p_card_id: cardId })
      setWorkCards(prev => prev.filter(c => String(c.id) !== String(cardId)))
      refreshTable('work_cards')
      refreshTable('inventory')
      alert('Деталі успішно передані на Склад Готової Продукції!')
    } catch (error) {
      refreshTable('work_cards')
      refreshTable('inventory')
      alert('Передачу на СГП не підтверджено: ' + error.message)
    }
  }

`+s.slice(end)
})
edit('src/modules/Sorting/hooks/useSortingTerminalData.js',s=>{
 s="import { confirmedRpc } from '../../../services/confirmedRpc.js'\n"+s
 const start=s.indexOf('  const submitSortingComplete =');const end=s.indexOf('  const handleManualSubmit =',start)
 return s.slice(0,start)+`  const submitSortingComplete = async () => {
    if (!activeCompletingCard || isProcessing) return
    const total = Number(activeCompletingCard.quantity)
    const scrap = Number(scrapCount)
    const rework = Number(reworkCount)
    if (![total, scrap, rework].every(Number.isFinite) || scrap < 0 || rework < 0 || scrap + rework > total) {
      setScanError('Брак і доопрацювання не можуть перевищувати кількість картки.')
      return
    }
    setIsProcessing(true)
    try {
      const goodQty = total - scrap - rework
      await confirmedRpc(supabase, 'rpc_submit_sorting_complete_atomic', {
        p_card_id: activeCompletingCard.id,
        p_good_qty: goodQty,
        p_scrap_qty: scrap,
        p_rework_qty: rework,
        p_operator_name: selectedOperator || activeCompletingCard.operator_name || 'Сортування',
        p_shift_name: selectedShift || activeCompletingCard.shift_name || 'Без зміни'
      })
      setShowCompleteModal(false)
      setActiveCompletingCard(null)
      setManualId('')
      setScanError(null)
      setScrapCount(0)
      setReworkCount(0)
      alert('✅ ' + goodQty + ' шт відправлено в буфер Цеху №2!')
    } catch (error) {
      setScanError('Сортування не підтверджено: ' + error.message)
    } finally {
      fetchData(['work_cards', 'work_card_history', 'inventory']).catch(() => {})
      setIsProcessing(false)
    }
  }

`+s.slice(end)
})
edit('src/modules/Foreman/hooks/useMachineAssignment.js',s=>s.replaceAll('await Promise.all(inventoryUpdates)',`await checkReservationResults(inventoryUpdates)`).replaceAll('await Promise.all(newInventoryReservations)',`await checkReservationResults(newInventoryReservations)`).replace('export function useMachineAssignment',`async function checkReservationResults(operations) {
  const results = await Promise.all(operations)
  for (const result of results) {
    if (result.error) throw result.error
    if (result.data?.success !== true) throw new Error(result.data?.error || 'Резервування не підтверджене сервером')
  }
}

export function useMachineAssignment`))
for(const path of ['src/modules/Shipping/hooks/useShippingData.jsx','src/modules/Packaging/hooks/usePackagingData.jsx']) {
 edit(path,s=>s.replace(/(await supabase\.from\('(?:tasks|orders)'\)\.update\([\s\S]*?\.eq\('id', [^\n]+?\))(?!\.)/g,'$1.throwOnError()')
 .replace(".eq('id', activeBatchData.orderId)\n", ".eq('id', activeBatchData.orderId).throwOnError()\n")
 .replace("const { data: siblingTasks } = await supabase", "const { data: siblingTasks, error: siblingError } = await supabase")
 .replace("const allShipped = (siblingTasks || []).every", "if (siblingError) throw siblingError\n      const allShipped = Boolean(siblingTasks?.length) && siblingTasks.every")
 .replace("const { data: freshTasks } = await supabase.from('tasks').select('id, status, plan_snapshot, planned_sets').eq('order_id', activeBatchData.orderId)","const { data: freshTasks, error: tasksError } = await supabase.from('tasks').select('id, status, plan_snapshot, planned_sets').eq('order_id', activeBatchData.orderId)\n      if (tasksError) throw tasksError")
 .replace("const allTasksPackaged = (freshTasks || []).every", "const allTasksPackaged = Boolean(freshTasks?.length) && freshTasks.every"))
}
