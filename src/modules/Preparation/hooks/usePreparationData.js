import { useState, useEffect, useMemo } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'

export const usePreparationData = () => {
  const { tasks, setTasks, nomenclatures, getFilteredOperators, requests, inventory, orders } = useMES()

  const [selectedSubTaskId, setSelectedSubTaskId] = useState(null)
  const [selectedShift, setSelectedShift] = useState('')
  const [selectedOperator, setSelectedOperator] = useState('')
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isProcessing, setIsProcessing] = useState(false)
  const [hasUserDeselected, setHasUserDeselected] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [completeQty, setCompleteQty] = useState(0)
  const [scrapQty, setScrapQty] = useState(0)
  const [scrapReason, setScrapReason] = useState('')

  // Clear operator when task selection changes
  useEffect(() => {
    setSelectedOperator('')
  }, [selectedSubTaskId])

  // Live timer tick
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatElapsedTime = (startIso) => {
    if (!startIso) return '00:00:00'
    const start = new Date(startIso)
    const diff = Math.floor((currentTime - start) / 1000)
    if (isNaN(diff) || diff < 0) return '00:00:00'
    const h = Math.floor(diff / 3600).toString().padStart(2, '0')
    const m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0')
    const s = (diff % 60).toString().padStart(2, '0')
    return `${h}:${m}:${s}`
  }

  // Generate virtual sub-tasks for each item in task's plan_snapshot
  const prepSubTasks = useMemo(() => {
    const list = []
    tasks.filter(t => 
      t.step === 'Підготовка' && 
      t.status !== 'completed' && 
      (t.warehouse_conf === 'true' || Object.values(t.plan_snapshot || {}).some(item => item.status === 'in-progress' || item.status === 'completed'))
    ).forEach(t => {
      if (t.plan_snapshot) {
        Object.entries(t.plan_snapshot).forEach(([nomId, item]) => {
          if (nomId.startsWith('_')) return
          const itemStatus = item.status || 'new'
          if (itemStatus !== 'completed') {
            list.push({
              id: `${t.id}_${nomId}`,
              taskId: t.id,
              nomenclatureId: nomId,
              name: item.name || 'Лист',
              plan: Number(item.plan || item.need || 0),
              status: itemStatus,
              operator: item.operator || '',
              task: t
            })
          }
        })
      } else {
        list.push({
          id: `${t.id}_default`,
          taskId: t.id,
          nomenclatureId: null,
          name: 'Сировина',
          plan: t.planned_sets || 0,
          status: t.status === 'in-progress' ? 'in-progress' : 'new',
          operator: '',
          task: t
        })
      }
    })
    return list
  }, [tasks])

  // Auto-select the first sub-task if none is selected
  useEffect(() => {
    if (prepSubTasks.length > 0) {
      const exists = prepSubTasks.some(s => s.id === selectedSubTaskId)
      if (!exists && !hasUserDeselected) {
        setSelectedSubTaskId(prepSubTasks[0].id)
      } else if (!exists && hasUserDeselected) {
        setSelectedSubTaskId(null)
      }
    } else {
      setSelectedSubTaskId(null)
    }
  }, [prepSubTasks, selectedSubTaskId, hasUserDeselected])

  const currentSubTask = useMemo(() => {
    return prepSubTasks.find(s => s.id === selectedSubTaskId) || null
  }, [prepSubTasks, selectedSubTaskId])

  const handleSelectSubTask = (id) => {
    setSelectedSubTaskId(id)
    setHasUserDeselected(false)
    setIsDrawerOpen(false)
  }

  const handleStart = async () => {
    if (!currentSubTask || !selectedOperator || !selectedShift) return alert('Оберіть зміну та працівника!')
    setIsProcessing(true)
    const parentTask = currentSubTask.task
    const now = new Date().toISOString()
    try {
      const { data: latestTask, error: fetchErr } = await supabase
        .from('tasks')
        .select('plan_snapshot, started_at')
        .eq('id', parentTask.id)
        .single()
      if (fetchErr) throw fetchErr

      const updatedSnapshot = { ...(latestTask.plan_snapshot || {}) }
      if (currentSubTask.nomenclatureId) {
        updatedSnapshot[currentSubTask.nomenclatureId] = {
          ...(updatedSnapshot[currentSubTask.nomenclatureId] || {}),
          status: 'in-progress',
          operator: selectedOperator,
          shift: selectedShift,
          started_at: now
        }
      }

      const patchedTask = {
        status: 'in-progress',
        started_at: latestTask.started_at || now,
        plan_snapshot: updatedSnapshot
      }

      setTasks(prev => prev.map(t => t.id === parentTask.id ? { ...t, ...patchedTask } : t))
      const { error } = await supabase.from('tasks').update(patchedTask).eq('id', parentTask.id)
      if (error) {
        setTasks(prev => prev.map(t => t.id === parentTask.id ? parentTask : t))
        throw error
      }
    } catch (e) {
      alert('Помилка: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCompleteClick = () => {
    if (!currentSubTask) return
    setCompleteQty(currentSubTask.plan)
    setScrapQty(0)
    setScrapReason('')
    setShowCompleteModal(true)
  }

  const submitCompletion = async () => {
    if (!currentSubTask) return
    setIsProcessing(true)
    try {
      const parentTask = currentSubTask.task
      const nomId = currentSubTask.nomenclatureId
      if (!nomId) throw new Error('Не знайдено матеріал в завданні!')

      const material = nomenclatures.find(n => String(n.id) === String(nomId))
      if (!material) throw new Error('Не знайдено номенклатуру матеріалу!')

      if (scrapQty > 0 && !scrapReason.trim()) {
        throw new Error('Будь ласка, вкажіть причину браку!')
      }

      const updatedSnapshot = { ...(parentTask.plan_snapshot || {}) }
      const currentItem = updatedSnapshot[nomId] || {}

      if (scrapQty > 0) {
        updatedSnapshot[nomId] = {
          ...currentItem,
          status: 'new',
          plan: Number(scrapQty),
          operator: '',
          started_at: null,
          total_good: (Number(currentItem.total_good) || 0) + Number(completeQty),
          total_scrap: (Number(currentItem.total_scrap) || 0) + Number(scrapQty),
          scrap_reason: scrapReason.trim(),
          actual_complete: completeQty,
          actual_scrap: scrapQty
        }
      } else {
        updatedSnapshot[nomId] = {
          ...currentItem,
          status: 'completed',
          completed_at: new Date().toISOString(),
          total_good: (Number(currentItem.total_good) || 0) + Number(completeQty),
          total_scrap: (Number(currentItem.total_scrap) || 0) + Number(scrapQty),
          actual_complete: completeQty,
          actual_scrap: scrapQty,
          scrap_reason: ''
        }
      }

      const allSubTasksCompleted = Object.entries(updatedSnapshot)
        .filter(([key]) => !key.startsWith('_'))
        .every(([_, item]) => item.status === 'completed')

      const totalProduced = Object.entries(updatedSnapshot)
        .filter(([key]) => !key.startsWith('_'))
        .reduce((sum, [_, item]) => sum + (Number(item.total_good) || Number(item.actual_complete) || 0), 0)

      const totalScrap = Object.entries(updatedSnapshot)
        .filter(([key]) => !key.startsWith('_'))
        .reduce((sum, [_, item]) => sum + (Number(item.total_scrap) || Number(item.actual_scrap) || 0), 0)

      const writeOps = []

      writeOps.push(supabase.from('tasks').update({
        status: allSubTasksCompleted ? 'completed' : 'in-progress',
        completed_at: allSubTasksCompleted ? new Date().toISOString() : null,
        good_qty: totalProduced,
        scrap_qty: totalScrap,
        plan_snapshot: updatedSnapshot,
        warehouse_conf: scrapQty > 0 ? 'false' : parentTask.warehouse_conf
      }).eq('id', parentTask.id))

      const reqs = (requests || []).filter(r => 
        String(r.task_id) === String(parentTask.id) &&
        String(r.nomenclature_id) === String(nomId) &&
        r.status === 'issued'
      )

      if (reqs && reqs.length > 0) {
        const inventoryIds = reqs.map(r => r.inventory_id).filter(Boolean)
        if (inventoryIds.length > 0) {
          const invItems = (inventory || []).filter(i => inventoryIds.includes(i.id))
          if (invItems.length > 0) {
            const deductionMap = {}
            for (const req of reqs) {
              if (req.inventory_id) {
                deductionMap[req.inventory_id] = (deductionMap[req.inventory_id] || 0) + Number(req.quantity)
              }
            }
            const updates = invItems.map(invItem => {
              const deductQty = deductionMap[invItem.id] || 0
              return {
                ...invItem,
                total_qty: Math.max(0, (Number(invItem.total_qty) || 0) - deductQty),
                reserved_qty: Math.max(0, (Number(invItem.reserved_qty) || 0) - deductQty)
              }
            })
            writeOps.push(supabase.from('inventory').upsert(updates))
          }
        }
        writeOps.push(supabase
          .from('material_requests')
          .update({ status: 'completed' })
          .eq('task_id', parentTask.id)
          .eq('nomenclature_id', nomId)
          .eq('status', 'issued'))
      }

      const prepName = material.name.replace('[Непідготовлений]', '[Підготовлений]')
      let prepNom = nomenclatures.find(n => n.name === prepName)
      if (!prepNom) {
        prepNom = nomenclatures.find(n => n.name.includes('[Підготовлений]') && material.name.replace(' [Непідготовлений]', '') === n.name.replace(' [Підготовлений]', ''))
      }
      if (prepNom) {
        writeOps.push(supabase.from('reception_docs').insert([{
          items: [{ nomenclature_id: prepNom.id, name: prepNom.name, qty: Number(completeQty) }],
          status: 'shipped',
          order_id: parentTask.order_id || null,
          task_id: parentTask.id,
          target_warehouse: 'operational',
          source_warehouse: null,
          created_at: new Date().toISOString()
        }]))
      }

      if (scrapQty > 0) {
        const order = (orders || []).find(o => String(o.id) === String(parentTask.order_id))
        const orderNum = order?.order_num || '???'
        
        const detailsText = `СВ: ${material.name} — ${scrapQty} л. (Дозабезпечення браку наряд #${orderNum}${parentTask.batch_index ? `/${parentTask.batch_index}` : ''})`
        
        writeOps.push(supabase.from('material_requests').insert({
          task_id: parentTask.id,
          order_id: parentTask.order_id,
          nomenclature_id: nomId,
          quantity: scrapQty,
          status: 'pending',
          details: detailsText
        }))
      }

      const results = await Promise.all(writeOps)
      for (const r of results) {
        if (r.error) throw r.error
      }

      setTasks(prev => prev.map(t => t.id === parentTask.id ? {
        ...t,
        status: allSubTasksCompleted ? 'completed' : 'in-progress',
        completed_at: allSubTasksCompleted ? new Date().toISOString() : null,
        good_qty: totalProduced,
        scrap_qty: totalScrap,
        plan_snapshot: updatedSnapshot,
        warehouse_conf: scrapQty > 0 ? 'false' : parentTask.warehouse_conf
      } : t))

      setShowCompleteModal(false)
      setSelectedSubTaskId(null)
      setHasUserDeselected(false)
    } catch (e) {
      alert('Помилка: ' + e.message)
    } finally {
      setIsProcessing(false)
    }
  }

  const prepOperators = getFilteredOperators('Відділ Підготовки', selectedShift, 'підготовка')

  return {
    prepSubTasks,
    currentSubTask,
    selectedSubTaskId,
    setSelectedSubTaskId,
    selectedShift,
    setSelectedShift,
    selectedOperator,
    setSelectedOperator,
    currentTime,
    isProcessing,
    isDrawerOpen,
    setIsDrawerOpen,
    showCompleteModal,
    setShowCompleteModal,
    completeQty,
    setCompleteQty,
    scrapQty,
    setScrapQty,
    scrapReason,
    setScrapReason,
    prepOperators,
    formatElapsedTime,
    handleSelectSubTask,
    handleStart,
    handleCompleteClick,
    submitCompletion,
    setHasUserDeselected
  }
}
