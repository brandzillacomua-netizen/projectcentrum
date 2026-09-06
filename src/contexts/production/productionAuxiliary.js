import { supabase } from '../../supabase.js'

export function createProductionAuxiliaryActions({
  orders, tasks, inventory, nomenclatures, bomItems, workCards,
  machineOperations, machines, systemUsers, currentUser,
  setTasks, setWorkCards, setWorkCardHistory, setManagementTasks, setMachines,
  normalize, refreshTable, fetchData,
  deductIssuedMaterialsForTask,
  maintenanceCheckEnabled
}) {
  const upsertNomenclature = async (nom) => { await supabase.from('nomenclatures').upsert([nom]); refreshTable('nomenclatures') }
  const deleteNomenclature = async (id) => {
    try {
      await supabase.from('machine_operations').delete().eq('nomenclature_id', id)
      await supabase.from('bom_items').delete().eq('parent_id', id)
      await supabase.from('bom_items').delete().eq('child_id', id)
      await supabase.from('inventory').delete().eq('nomenclature_id', id)
      await supabase.from('order_items').delete().eq('nomenclature_id', id)
      await supabase.from('material_requests').delete().eq('nomenclature_id', id)
      await supabase.from('replenishment_requests').delete().eq('nomenclature_id', id)
      await supabase.from('nomenclature_catalog_profiles').delete().eq('nomenclature_id', id)
      const { error } = await supabase.from('nomenclatures').delete().eq('id', id)
      if (error) throw error
    } catch (err) {
      console.error("Failed to delete nomenclature cascades:", err)
      alert("Не вдалося видалити номенклатуру: " + err.message)
    }
    refreshTable('nomenclatures')
  }

  const saveBOM = async (parentId, childId, qty) => {
    await supabase.from('bom_items').upsert([{ parent_id: parentId, child_id: childId, quantity_per_parent: Number(qty) }], { onConflict: 'parent_id, child_id' })
    refreshTable('bom_items')
  }
  const removeBOM = async (bomId) => { await supabase.from('bom_items').delete().eq('id', bomId); refreshTable('bom_items') }
  const syncBOM = async (parentId, items) => {
    await supabase.from('bom_items').delete().eq('parent_id', parentId)
    if (items.length > 0) await supabase.from('bom_items').insert(items.map(it => ({ parent_id: parentId, child_id: it.child_id, quantity_per_parent: Number(it.qty) })))
    refreshTable('bom_items')
  }


  const addManagementTask = async (taskPayload, currentUserLogin) => {
    const allowedFields = [
      'title', 'description', 'priority', 'color', 'assigned_to', 'assignees',
      'is_collective', 'department', 'deadline', 'checklist', 'status', 'project_id'
    ]
    const cleanPayload = allowedFields.reduce((result, field) => {
      if (taskPayload[field] !== undefined) result[field] = taskPayload[field]
      return result
    }, {})
    cleanPayload.deadline = cleanPayload.deadline || null
    cleanPayload.assignees = Array.isArray(cleanPayload.assignees) ? cleanPayload.assignees : []
    cleanPayload.checklist = Array.isArray(cleanPayload.checklist) ? cleanPayload.checklist : []

    const newTaskObj = {
      id: 'task_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      ...cleanPayload,
      created_by: currentUserLogin || 'system',
      created_at: new Date().toISOString()
    }

    setManagementTasks(prev => [newTaskObj, ...prev])
    try {
      const saved = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')
      localStorage.setItem('centrum_created_management_tasks', JSON.stringify([newTaskObj, ...saved.filter(t => t.id !== newTaskObj.id)]))
    } catch { /* ignore storage error */ }

    try {
      const { data, error } = await supabase.from('management_tasks').insert([cleanPayload]).select()
      if (!error && data?.[0]) {
        setManagementTasks(prev => prev.map(t => t.id === newTaskObj.id ? data[0] : t))
        return { data: data[0], error: null }
      }
      return { data: newTaskObj, error }
    } catch (err) {
      return { data: newTaskObj, error: err }
    }
  }
  const updateManagementTask = async (taskId, updates) => {
    setManagementTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t))
    try {
      const savedTasks = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')
      const updatedTasks = savedTasks.map(t => t.id === taskId ? { ...t, ...updates } : t)
      localStorage.setItem('centrum_created_management_tasks', JSON.stringify(updatedTasks))
    } catch { /* ignore storage error */ }

    if (updates.status || updates.project_id) {
      try {
        const saved = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
        saved[taskId] = { ...(saved[taskId] || {}), ...updates }
        localStorage.setItem('centrum_task_status_updates', JSON.stringify(saved))
      } catch { /* ignore storage error */ }
    }
    const { error } = await supabase.from('management_tasks').update(updates).eq('id', taskId)
    return { error }
  }
  const deleteManagementTask = async (taskId) => {
    setManagementTasks(prev => prev.filter(t => t.id !== taskId))
    try {
      const savedTasks = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')
      localStorage.setItem('centrum_created_management_tasks', JSON.stringify(savedTasks.filter(t => t.id !== taskId)))

      const savedUpdates = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
      delete savedUpdates[taskId]
      localStorage.setItem('centrum_task_status_updates', JSON.stringify(savedUpdates))
    } catch { /* ignore storage error */ }

    const { error } = await supabase.from('management_tasks').delete().eq('id', taskId)
    return { error }
  }

  const addMachine = async (machineData) => {
    const { data, error } = await supabase.from('machines').insert([machineData]).select()
    if (!error && data?.[0]) setMachines(prev => [...prev, data[0]])
    return { data: data?.[0], error }
  }
  const updateMachine = async (id, updates) => {
    setMachines(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m))
    const { error } = await supabase.from('machines').update(updates).eq('id', id)
    return { error }
  }
  const deleteMachine = async (id) => {
    const { error } = await supabase.from('machines').delete().eq('id', id)
    if (!error) setMachines(prev => prev.filter(m => m.id !== id))
    return { error }
  }


  const disposeScrapItem = async (invId, qty) => {
    const item = inventory.find(i => i.id === invId)
    if (!item) return
    const nextQty = (Number(item.total_qty) || 0) - Number(qty)
    if (nextQty > 0) await supabase.from('inventory').update({ total_qty: nextQty }).eq('id', invId)
    else await supabase.from('inventory').delete().eq('id', invId)
    await supabase.from('reception_docs').insert([{ doc_num: `DIS-${Date.now().toString().slice(-6)}`, type: 'scrap_disposal', status: 'completed', items: JSON.stringify([{ name: item.name, qty: qty, nomenclature_id: item.nomenclature_id, disposed_at: new Date().toISOString() }]) }])
    refreshTable('inventory')
  }

  const createReworkNaryad = async (invId, qty, stage) => {
    const scrapItem = inventory.find(i => i.id === invId)
    if (!scrapItem) return
    const nomId = scrapItem.nomenclature_id
    const nom = nomenclatures.find(n => n.id === nomId)
    const vbOrders = (orders || []).filter(o => o.order_num && o.order_num.startsWith('ВБ'))
    const maxNum = vbOrders.reduce((max, o) => { const numPart = o.order_num.replace('ВБ', ''); const num = parseInt(numPart); return isNaN(num) ? max : Math.max(max, num) }, 0)
    const nextOrderNum = `ВБ${String(maxNum + 1).padStart(4, '0')}`

    // 1. Start inventory update/delete immediately in parallel
    const nextQty = (Number(scrapItem.total_qty) || 0) - Number(qty)
    const inventoryPromise = nextQty > 0
      ? supabase.from('inventory').update({ total_qty: nextQty }).eq('id', scrapItem.id)
      : supabase.from('inventory').delete().eq('id', scrapItem.id)

    // 2. Sequential path for inserts (Order -> Task -> Card)
    const { data: reworkOrder, error: orderErr } = await supabase
      .from('orders')
      .insert([{ order_num: nextOrderNum, customer: 'ВНУТРІШНЄ ДООПРАЦЮВАННЯ', status: 'in-progress' }])
      .select()
      .single()

    if (orderErr) {
      console.error("Error creating rework order:", orderErr)
      return
    }

    const orderId = reworkOrder?.id || null
    const plan_snapshot = { [nomId]: { id: nomId, name: nom?.name || scrapItem.name, code: nom?.nomenclature_code || '—', need: qty, stock: 0, plan: qty, is_rework: true } }

    const { data: taskData } = await supabase
      .from('tasks')
      .insert([{
        order_id: orderId,
        step: stage,
        status: 'waiting',
        machine_name: 'Доопрацювання',
        estimated_time: 0,
        engineer_conf: true,
        warehouse_conf: 'true',
        director_conf: true,
        plan_snapshot: plan_snapshot,
        planned_sets: 0
      }])
      .select()

    const newTask = taskData?.[0]
    let cardPromise = Promise.resolve()
    const isRestoration = stage.includes('Пресування') || stage.includes('Фарбування')
    const cardInfoText = isRestoration 
      ? `[RESTORATION] [ЦЕХ №2] ${nom?.name || scrapItem.name} — ВНУТРІШНЄ ВІДНОВЛЕННЯ ВКЯ`
      : `[REWORK] [ЦЕХ №2] ${nom?.name || scrapItem.name} — ДООПРАЦЮВАННЯ БРАКУ`

    if (newTask) {
      cardPromise = supabase
        .from('work_cards')
        .insert([{
          task_id: newTask.id,
          order_id: orderId,
          nomenclature_id: nomId,
          quantity: qty,
          status: 'new',
          operation: stage,
          card_info: cardInfoText
        }])
    }

    // 3. Await all inserts & updates in parallel
    await Promise.all([inventoryPromise, cardPromise])

    // 4. Refresh only affected tables in parallel (much faster than full fetchData(true))
    await Promise.all([
      refreshTable('orders'),
      refreshTable('tasks'),
      refreshTable('work_cards'),
      refreshTable('inventory')
    ])
  }

  return {
    upsertNomenclature,
    deleteNomenclature,
    saveBOM,
    removeBOM,
    syncBOM,
    addManagementTask,
    updateManagementTask,
    deleteManagementTask,
    addMachine,
    updateMachine,
    deleteMachine,
    disposeScrapItem,
    createReworkNaryad
  }
}
