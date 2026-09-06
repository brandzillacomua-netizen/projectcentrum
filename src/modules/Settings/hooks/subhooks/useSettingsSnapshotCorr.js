import { useState } from 'react'

export function useSettingsSnapshotCorr({ supabase, refreshTable }) {
  const [corrSearchQuery, setCorrSearchQuery] = useState('')
  const [corrFoundTasks, setCorrFoundTasks] = useState([])
  const [corrSelectedTask, setCorrSelectedTask] = useState(null)
  const [corrSnapshotParts, setCorrSnapshotParts] = useState([])
  const [corrIsSaving, setCorrIsSaving] = useState(false)
  const [corrSearchLoading, setCorrSearchLoading] = useState(false)

  const handleSearchTasks = async () => {
    if (!corrSearchQuery.trim()) return
    setCorrSearchLoading(true)
    setCorrFoundTasks([])
    setCorrSelectedTask(null)
    try {
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_num, customer')
        .ilike('order_num', `%${corrSearchQuery.trim()}%`)
      
      if (ordersError) throw ordersError
      
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id)
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*')
          .in('order_id', orderIds)
          .order('created_at', { ascending: false })
          
        if (tasksError) throw tasksError
        
        const mapped = (tasksData || []).map(t => {
          const ord = ordersData.find(o => o.id === t.order_id)
          return {
            ...t,
            order_num: ord ? ord.order_num : 'Невідомо',
            customer: ord ? ord.customer : 'Невідомо'
          }
        })
        setCorrFoundTasks(mapped)
      } else {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('*, orders(order_num, customer)')
          .eq('id', corrSearchQuery.trim())
        if (!tasksError && tasksData && tasksData.length > 0) {
          const mapped = tasksData.map(t => ({
            ...t,
            order_num: t.orders ? t.orders.order_num : 'Невідомо',
            customer: t.orders ? t.orders.customer : 'Невідомо'
          }))
          setCorrFoundTasks(mapped)
        }
      }
    } catch (err) {
      console.error(err)
      alert('Помилка пошуку нарядів: ' + err.message)
    } finally {
      setCorrSearchLoading(false)
    }
  }

  const handleSelectTask = (task) => {
    setCorrSelectedTask(task)
    if (task && task.plan_snapshot) {
      const parts = []
      Object.entries(task.plan_snapshot).forEach(([key, val]) => {
        if (key !== 'materialSummary' && key !== 'selectedCutters' && key !== 'consumables' && !key.startsWith('_')) {
          parts.push({
            nomenclature_id: key,
            id: val.id || key,
            name: val.name || 'Без назви',
            code: val.code || 'Без коду',
            need: Number(val.need) || 0,
            stock: Number(val.stock) || 0,
            plan: Number(val.plan) || 0,
            sheets: Number(val.sheets) || 0,
            sheets_t300: Number(val.sheets_t300) || 0,
            sheets_t700: Number(val.sheets_t700) || 0,
            units_per_sheet: Number(val.units_per_sheet) || 1,
            material: val.material || '',
            order_item_id: val.order_item_id || '',
            selected_machine: val.selected_machine || val.machine || '',
            cutter_override: val.cutter_override || '2',
            splits: val.splits || []
          })
        }
      })
      setCorrSnapshotParts(parts)
    } else {
      setCorrSnapshotParts([])
    }
  }

  const handlePartStockChange = (nomId, val) => {
    const newStock = Math.max(0, parseInt(val) || 0)
    setCorrSnapshotParts(prev => prev.map(p => {
      if (p.nomenclature_id === nomId) {
        const newPlan = Math.max(0, p.need - newStock)
        const unitsPerSheet = p.units_per_sheet || 1
        const newSheets = Math.ceil(newPlan / unitsPerSheet)
        const isT700 = (p.material || p.name || '').toLowerCase().includes('т700') || (p.material || p.name || '').toLowerCase().includes('t700')
        return {
          ...p,
          stock: newStock,
          plan: newPlan,
          sheets: newSheets,
          sheets_t300: isT700 ? 0 : newSheets,
          sheets_t700: isT700 ? newSheets : 0
        }
      }
      return p
    }))
  }

  const handlePartSheetsChange = (nomId, val) => {
    const newSheets = Math.max(0, parseInt(val) || 0)
    setCorrSnapshotParts(prev => prev.map(p => {
      if (p.nomenclature_id === nomId) {
        const isT700 = (p.material || p.name || '').toLowerCase().includes('т700') || (p.material || p.name || '').toLowerCase().includes('t700')
        return {
          ...p,
          sheets: newSheets,
          sheets_t300: isT700 ? 0 : newSheets,
          sheets_t700: isT700 ? newSheets : 0
        }
      }
      return p
    }))
  }

  const handleSaveCorrection = async () => {
    if (!corrSelectedTask) return
    if (!window.confirm('Ви впевнені, що хочете зберегти ці зміни снапшоту? Це оновить дані в наряді, запитах матеріалів та картах БЗ.')) return
    
    setCorrIsSaving(true)
    try {
      const taskId = corrSelectedTask.id
      const orderId = corrSelectedTask.order_id
      
      const { data: siblingTasks, error: siblingErr } = await supabase
        .from('tasks')
        .select('*')
        .eq('order_id', orderId)
        
      if (siblingErr) throw siblingErr

      const { data: materialRequests, error: matErr } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', taskId)
        
      if (matErr) throw matErr

      const { data: workCardsData, error: wcErr } = await supabase
        .from('work_cards')
        .select('*')
        .eq('task_id', taskId)
        
      if (wcErr) throw wcErr

      const dbWrites = []

      for (const siblingTask of (siblingTasks || [])) {
        const currentSnap = siblingTask.plan_snapshot || {}
        const newSnap = { ...currentSnap }
        
        corrSnapshotParts.forEach(p => {
          newSnap[p.nomenclature_id] = {
            id: p.id,
            name: p.name,
            code: p.code,
            need: p.need,
            stock: p.stock,
            plan: p.plan,
            sheets: p.sheets,
            sheets_t300: p.sheets_t300,
            sheets_t700: p.sheets_t700,
            material: p.material,
            order_item_id: p.order_item_id,
            selected_machine: p.selected_machine,
            machine: p.selected_machine,
            cutter_override: p.cutter_override,
            splits: p.splits,
            units_per_sheet: p.units_per_sheet
          }
        })
        
        if (newSnap.materialSummary) {
          const newMatSummary = { ...newSnap.materialSummary }
          
          corrSnapshotParts.forEach(p => {
            Object.entries(newMatSummary).forEach(([matId, matInfo]) => {
              if (matInfo.components) {
                const hasComp = matInfo.components.some(c => c.startsWith(p.name + ':'))
                if (hasComp) {
                  newMatSummary[matId] = {
                    ...matInfo,
                    sheets: p.sheets,
                    totalUnits: p.plan,
                    components: [`${p.name}: ${p.plan}шт`]
                  }
                }
              }
            })
          })
          newSnap.materialSummary = newMatSummary
        }
        
        dbWrites.push(
          supabase.from('tasks').update({ plan_snapshot: newSnap }).eq('id', siblingTask.id)
        )
      }

      corrSnapshotParts.forEach(p => {
        const matchingRequest = (materialRequests || []).find(r => 
          r.details && 
          r.details.includes('СКЛАД ОПЕРАТИВНИЙ:') && 
          r.details.includes(p.name)
        )
        if (matchingRequest) {
          const cleanMatName = matchingRequest.details.match(/СКЛАД ОПЕРАТИВНИЙ:\s*(.*?)\s*—/)?.[1] || 'Лист'
          const updatedDetails = `СКЛАД ОПЕРАТИВНИЙ: ${cleanMatName} — ${p.sheets} л. (Разом: ${p.plan} шт | Для: ${p.name}: ${p.plan}шт)`
          
          dbWrites.push(
            supabase.from('material_requests').update({
              quantity: p.sheets,
              details: updatedDetails
            }).eq('id', matchingRequest.id)
          )
        }
      })

      corrSnapshotParts.forEach(p => {
        const bzCard = (workCardsData || []).find(c => 
          String(c.nomenclature_id) === String(p.nomenclature_id) && 
          c.card_info && 
          c.card_info.includes('[ЗІ СКЛАДУ БЗ]')
        )
        
        if (bzCard) {
          if (p.stock > 0) {
            dbWrites.push(
              supabase.from('work_cards').update({ quantity: p.stock }).eq('id', bzCard.id)
            )
            dbWrites.push(
              supabase.from('work_card_history').update({
                qty_at_start: p.stock,
                qty_completed: p.stock
              }).eq('card_id', bzCard.id)
            )
          } else {
            dbWrites.push(
              supabase.from('work_cards').delete().eq('id', bzCard.id)
            )
            dbWrites.push(
              supabase.from('work_card_history').delete().eq('card_id', bzCard.id)
            )
          }
        } else if (p.stock > 0) {
          const createCard = async () => {
            const { data: insertedCard, error: insErr } = await supabase
              .from('work_cards')
              .insert([{
                task_id: taskId,
                order_id: orderId,
                nomenclature_id: p.nomenclature_id,
                quantity: p.stock,
                status: 'completed',
                operation: 'Склад БЗ',
                card_info: '[ЗІ СКЛАДУ БЗ]'
              }])
              .select()
              .single()
            if (!insErr && insertedCard) {
              await supabase.from('work_card_history').insert([{
                card_id: insertedCard.id,
                nomenclature_id: p.nomenclature_id,
                stage_name: 'Склад БЗ',
                operator_name: 'Склад (БРОНЬ)',
                qty_at_start: p.stock,
                qty_completed: p.stock,
                scrap_qty: 0,
                completed_at: new Date().toISOString()
              }])
            }
          }
          dbWrites.push(createCard())
        }
      })

      const partIds = corrSnapshotParts.map(p => p.nomenclature_id)
      const { data: currentInventory, error: invFetchErr } = await supabase
        .from('inventory')
        .select('*')
        .in('nomenclature_id', partIds)
        
      if (!invFetchErr && currentInventory) {
        corrSnapshotParts.forEach(p => {
          const originalPart = corrSelectedTask.plan_snapshot?.[p.nomenclature_id]
          const oldStock = originalPart ? (Number(originalPart.stock) || 0) : 0
          const diff = p.stock - oldStock
          
          if (diff !== 0) {
            const bzItem = currentInventory.find(i => 
              String(i.nomenclature_id) === String(p.nomenclature_id) && 
              i.type === 'bz'
            )
            if (bzItem) {
              dbWrites.push(
                supabase.from('inventory').update({
                  total_qty: Math.max(0, (Number(bzItem.total_qty) || 0) - diff),
                  updated_at: new Date().toISOString()
                }).eq('id', bzItem.id)
              )
            }

            const finishedItem = currentInventory.find(i => 
              String(i.nomenclature_id) === String(p.nomenclature_id) && 
              i.type === 'finished'
            )
            if (finishedItem) {
              dbWrites.push(
                supabase.from('inventory').update({
                  total_qty: Math.max(0, (Number(finishedItem.total_qty) || 0) + diff),
                  updated_at: new Date().toISOString()
                }).eq('id', finishedItem.id)
              )
            } else if (diff > 0) {
              dbWrites.push(
                supabase.from('inventory').insert([{
                  nomenclature_id: p.nomenclature_id,
                  name: p.name,
                  unit: 'шт',
                  total_qty: diff,
                  reserved_qty: 0,
                  type: 'finished',
                  updated_at: new Date().toISOString()
                }])
              )
            }
          }
        })
      }
  
      await Promise.all(dbWrites)
      alert('Зміни успішно збережено та застосовано!')
      
      if (refreshTable) {
        refreshTable('tasks')
        refreshTable('material_requests')
        refreshTable('work_cards')
        refreshTable('inventory')
      }
      
      const { data: updatedTask } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .single()
        
      if (updatedTask) {
        const ord = siblingTasks?.[0]?.order_num ? siblingTasks[0] : { order_num: corrSelectedTask.order_num, customer: corrSelectedTask.customer }
        handleSelectTask({
          ...updatedTask,
          order_num: ord.order_num,
          customer: ord.customer
        })
      }
      
      setCorrFoundTasks(prev => prev.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            plan_snapshot: updatedTask?.plan_snapshot || t.plan_snapshot
          }
        }
        return t
      }))
    } catch (e) {
      console.error(e)
      alert('Помилка збереження змін: ' + e.message)
    } finally {
      setCorrIsSaving(false)
    }
  }

  return {
    corrSearchQuery,
    setCorrSearchQuery,
    corrFoundTasks,
    setCorrFoundTasks,
    corrSelectedTask,
    setCorrSelectedTask,
    corrSnapshotParts,
    setCorrSnapshotParts,
    corrIsSaving,
    setCorrIsSaving,
    corrSearchLoading,
    setCorrSearchLoading,
    handleSearchTasks,
    handleSelectTask,
    handlePartStockChange,
    handlePartSheetsChange,
    handleSaveCorrection
  }
}
