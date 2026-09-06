import { useEffect, useMemo, useState } from 'react'
import { useMES } from '../../../MESContext'
import { supabase } from '../../../supabase'

const FINAL_STAGES = new Set(['пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'])
const ANALYTICS_PERIOD_DAYS = 30

export const useAnalyticsData = () => {
  const { tasks, orders, workCards, workCardHistory, nomenclatures } = useMES()
  const [archiveTab, setArchiveTab] = useState('shop1')
  const [expandedOrders, setExpandedOrders] = useState({})
  const [expandedNoms, setExpandedNoms] = useState({})
  const [analyticsHistory, setAnalyticsHistory] = useState(null)
  const [analyticsHistoryLoading, setAnalyticsHistoryLoading] = useState(false)
  const [analyticsHistoryError, setAnalyticsHistoryError] = useState('')

  const toggleOrder = (orderNum) => setExpandedOrders(prev => ({ ...prev, [orderNum]: !prev[orderNum] }))
  const toggleNom = (orderNum, nomId) => {
    const key = `${orderNum}_${nomId}`
    setExpandedNoms(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const periodStart = useMemo(() => {
    const date = new Date()
    date.setDate(date.getDate() - ANALYTICS_PERIOD_DAYS)
    date.setHours(0, 0, 0, 0)
    return date
  }, [])

  // --- DATA AGGREGATION ---
  useEffect(() => {
    let cancelled = false

    const loadPeriodHistory = async () => {
      setAnalyticsHistoryLoading(true)
      setAnalyticsHistoryError('')
      try {
        const pageSize = 1000
        const rows = []
        const startIso = periodStart.toISOString()

        for (let offset = 0; !cancelled; offset += pageSize) {
          const { data, error } = await supabase
            .from('work_card_history')
            .select('id,card_id,nomenclature_id,stage_name,operator_name,qty_at_start,qty_completed,scrap_qty,completed_at,created_at,card_info')
            .gte('completed_at', startIso)
            .order('completed_at', { ascending: false })
            .range(offset, offset + pageSize - 1)

          if (error) throw error
          const page = data || []
          rows.push(...page)
          if (page.length < pageSize) break
        }

        if (!cancelled) {
          setAnalyticsHistory(Array.from(new Map(rows.map(row => [String(row.id), row])).values()))
        }
      } catch (error) {
        console.error('Failed to load analytics period history:', error)
        if (!cancelled) setAnalyticsHistoryError(error.message || 'Не вдалося завантажити історію за період')
      } finally {
        if (!cancelled) setAnalyticsHistoryLoading(false)
      }
    }

    loadPeriodHistory()
    return () => { cancelled = true }
  }, [periodStart])

  const historyForAnalytics = analyticsHistory || workCardHistory
  const periodHistory = useMemo(() => historyForAnalytics.filter(h => {
    const rawDate = h.completed_at || h.created_at
    if (!rawDate) return false
    const rowDate = new Date(rawDate)
    return !Number.isNaN(rowDate.getTime()) && rowDate >= periodStart
  }), [historyForAnalytics, periodStart])
  const nomenclatureById = useMemo(() => new Map((nomenclatures || []).map(n => [String(n.id), n])), [nomenclatures])

  const stats = useMemo(() => {
    // 1. On-Time Delivery %
    const completedOrders = orders.filter(o => o.status === 'completed' || tasks.some(t => t.order_id === o.id && t.status === 'completed'))
    const onTimeOrders = completedOrders.filter(o => {
      if (!o.deadline) return true
      const lastTask = tasks.filter(t => t.order_id === o.id).sort((a,b) => new Date(b.completed_at) - new Date(a.completed_at))[0]
      if (!lastTask?.completed_at) return true
      return new Date(lastTask.completed_at) <= new Date(o.deadline)
    })
    const onTimeRate = completedOrders.length > 0 ? Math.round((onTimeOrders.length / completedOrders.length) * 100) : 0
    const finalProductionHistory = periodHistory.filter(h => FINAL_STAGES.has(String(h.stage_name || '').toLowerCase().trim()))
    const totalProducedFull = finalProductionHistory.reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0)
    const totalScrapFull = periodHistory.reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
    const qualityRate = totalProducedFull > 0 ? (100 - Math.round((totalScrapFull / totalProducedFull) * 100)) : 0

    // 2. Operator Performance
    const operatorStats = periodHistory.reduce((acc, h) => {
      const name = h.operator_name || 'Невідомий'
      if (!acc[name]) acc[name] = { name, produced: 0, scrap: 0, actions: 0 }
      acc[name].produced += (Number(h.qty_completed) || 0)
      acc[name].scrap += (Number(h.scrap_qty) || 0)
      acc[name].actions += 1
      return acc
    }, {})
    const sortedOperators = Object.values(operatorStats).sort((a, b) => b.produced - a.produced)

    // 3. Estimated sheet usage
    const sheetUsageByMaterial = periodHistory.reduce((acc, h) => {
      const stageName = String(h.stage_name || '').trim().toLowerCase()
      if (stageName !== 'розкрій') return acc

      const nom = nomenclatureById.get(String(h.nomenclature_id))
      const material = nom?.material_type || 'Матеріал не вказано'
      const unitsPerSheet = Number(nom?.units_per_sheet) || 0
      const startedQty = Number(h.qty_at_start) || ((Number(h.qty_completed) || 0) + (Number(h.scrap_qty) || 0))
      const sheets = unitsPerSheet > 0 ? Math.ceil(startedQty / unitsPerSheet) : 0
      if (sheets <= 0) return acc

      if (!acc[material]) acc[material] = { sheets: 0, units: 0 }
      acc[material].sheets += sheets
      acc[material].units += startedQty
      return acc
    }, {})

    // 4. Time Analytics
    const completedTasks = tasks.filter(t => t.status === 'completed' && t.completed_at)
    const avgLeadTimeHours = completedTasks.length > 0 
      ? completedTasks.reduce((acc, t) => {
          const duration = (new Date(t.completed_at) - new Date(t.created_at)) / (1000 * 60 * 60)
          return acc + duration
        }, 0) / completedTasks.length 
      : 0

    // 5. Shop Load
    const steps = ["Розкрій", "Галтовка", "Пресування", "Фарбування", "Паквання"]
    const shopLoad = steps.map(step => {
      const activeInStep = tasks.filter(t => t.status !== 'completed' && t.step?.toLowerCase().includes(step.toLowerCase())).length
      const loadPercent = Math.min(100, Math.max(5, activeInStep * 20)) 
      return { step, count: activeInStep, loadPercent }
    })

    return {
      onTimeRate,
      qualityRate,
      shopLoad,
      sortedOperators,
      sheetUsageByMaterial,
      totalProducedFull,
      totalScrapFull,
      historyCount: periodHistory.length,
      totalHistoryCount: historyForAnalytics.length,
      avgLeadTimeHours: Math.round(avgLeadTimeHours * 10) / 10,
      totalOrders: orders.length,
      activeTasks: tasks.filter(t => t.status === 'in-progress').length
    }
  }, [tasks, orders, periodHistory, historyForAnalytics.length, nomenclatureById])

  return {
    ANALYTICS_PERIOD_DAYS,
    archiveTab,
    setArchiveTab,
    expandedOrders,
    toggleOrder,
    expandedNoms,
    toggleNom,
    analyticsHistoryLoading,
    analyticsHistoryError,
    periodHistory,
    nomenclatureById,
    workCards,
    orders,
    stats
  }
}
