import { useState } from 'react'
import { supabase } from '../../../supabase'
import { useMES } from '../../../MESContext'

export function useSettingsSnapshotCorr() {
  const { refreshTable } = useMES()

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

  return {
    corrSearchQuery, setCorrSearchQuery,
    corrFoundTasks, setCorrFoundTasks,
    corrSelectedTask, setCorrSelectedTask,
    corrSnapshotParts, setCorrSnapshotParts,
    corrIsSaving, setCorrIsSaving,
    corrSearchLoading, setCorrSearchLoading,
    handleSearchTasks, handleSelectTask,
    handlePartStockChange, handlePartSheetsChange
  }
}
