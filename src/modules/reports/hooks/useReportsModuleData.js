import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../supabase'
import { fetchArchiveTasksPaged, ARCHIVE_PAGE_SIZE } from '../../../services/archiveService.js'
import { useMES } from '../../../MESContext'
import { useWarehouseReport } from './useWarehouseReport'
import { useEmployeeReport } from './useEmployeeReport'
import { useScrapReport } from './useScrapReport'
import { useSuppliesReport } from './useSuppliesReport'
import { useCuttersReport } from './useCuttersReport'

export const HISTORY_REPORT_TABS = new Set(['employees', 'scrap', 'supplies', 'sheets', 'cutters', 'analytics'])
export const REPORT_CACHE_TTL_MS = 30 * 1000

export const dateInputBoundaryIso = (value, nextDay = false) => {
  if (!value) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day + (nextDay ? 1 : 0), 0, 0, 0, 0)
  return date.toISOString()
}

export function useReportsModuleData() {
  const { 
    inventory, 
    systemUsers, 
    workCardHistory: initialHistory, 
    tasks, 
    orders, 
    nomenclatures,
    receptionDocs,
    requests,
    normalize
  } = useMES()

  const [activeTab, setActiveTab] = useState('warehouse')
  const [scrapReportSubTab, setScrapReportSubTab] = useState('cases')
  const [scrapClassificationsList, setScrapClassificationsList] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [quickPeriod, setQuickPeriod] = useState('')

  // ── Archive tab state ──
  const [archiveLoaded, setArchiveLoaded] = useState(false)
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [allArchiveTasks, setAllArchiveTasks] = useState([])
  const [archiveSearch, setArchiveSearch] = useState('')
  const [archiveStatusFilter, setArchiveStatusFilter] = useState('all')
  const [archivePage, setArchivePage] = useState(0)
  const [archiveTotalCount, setArchiveTotalCount] = useState(0)
  const [archiveTotalPages, setArchiveTotalPages] = useState(0)

  const loadArchive = useCallback(async (targetPage = 0, currentSearch = archiveSearch, currentStatus = archiveStatusFilter) => {
    setArchiveLoading(true)
    try {
      const res = await fetchArchiveTasksPaged({
        page: targetPage,
        pageSize: ARCHIVE_PAGE_SIZE,
        status: currentStatus,
        search: currentSearch,
        knownOrders: orders
      })

      if (!res.error) {
        setAllArchiveTasks(res.tasks)
        setArchiveTotalCount(res.totalCount)
        setArchiveTotalPages(res.totalPages)
        setArchivePage(res.page)
        setArchiveLoaded(true)
      }
    } catch (e) {
      console.error('[useReportsModuleData] loadArchive error:', e)
    } finally {
      setArchiveLoading(false)
    }
  }, [archiveSearch, archiveStatusFilter, orders])

  useEffect(() => {
    let cancelled = false
    if (activeTab === 'archive') {
      const timer = setTimeout(() => {
        if (!cancelled) {
          loadArchive(0, archiveSearch, archiveStatusFilter)
        }
      }, 250)
      return () => {
        cancelled = true
        clearTimeout(timer)
      }
    }
  }, [activeTab, archiveSearch, archiveStatusFilter, loadArchive])

  const filteredArchiveTasks = allArchiveTasks

  const todayStr = new Date().toISOString().split('T')[0]
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(todayStr)
  const [workCardHistory, setWorkCardHistory] = useState(initialHistory)
  const [scrapReasonsDb, setScrapReasonsDb] = useState([])
  const [classifiedHistoryIds, setClassifiedHistoryIds] = useState(new Set())
  const [isSyncing, setIsSyncing] = useState(false)
  const [historyLoadError, setHistoryLoadError] = useState('')
  const [selectedShiftFilter, setSelectedShiftFilter] = useState('all')
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState('all')
  const historyRangeCacheRef = useRef(new Map())
  const historyRequestSeqRef = useRef(0)

  const uniqueOperators = useMemo(() => {
    const ops = new Set()
    systemUsers.forEach(u => {
      const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim()
      if (fullName) ops.add(fullName)
    })
    workCardHistory.forEach(h => {
      if (h.operator_name) ops.add(h.operator_name)
    })
    return Array.from(ops).filter(Boolean).sort()
  }, [systemUsers, workCardHistory])

  const fetchReportHistoryRange = async (startIso, endExclusiveIso, scrapOnly = false) => {
    const cacheKey = `${scrapOnly ? 'scrap' : 'all'}|${startIso || ''}|${endExclusiveIso || ''}`
    const cached = historyRangeCacheRef.current.get(cacheKey)
    if (cached && Date.now() - cached.savedAt < REPORT_CACHE_TTL_MS) return cached.rows

    const columns = 'id,card_id,nomenclature_id,operator_name,shift_name,stage_name,qty_completed,scrap_qty,qc_scrap_comment,completed_at,created_at,card_info'
    const pageSize = 1000
    const rows = []

    for (let from = 0; ; from += pageSize) {
      let query = supabase.from('work_card_history').select(columns)

      if (scrapOnly) query = query.gt('scrap_qty', 0)
      if (startIso) query = query.gte('created_at', startIso)
      if (endExclusiveIso) query = query.lt('created_at', endExclusiveIso)

      const result = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(from, from + pageSize - 1)

      if (result.error) throw result.error
      const page = result.data || []
      rows.push(...page)
      if (page.length < pageSize) break
    }

    historyRangeCacheRef.current.set(cacheKey, { rows, savedAt: Date.now() })
    return rows
  }

  const syncHistory = async (startStr, endStr) => {
    const requestSeq = ++historyRequestSeqRef.current
    setIsSyncing(true)
    setHistoryLoadError('')
    let startIso = dateInputBoundaryIso(startStr)
    const endExclusiveIso = dateInputBoundaryIso(endStr, true)

    if (!startIso) {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      startIso = d.toISOString()
    }

    try {
      const scrapOnly = activeTab === 'scrap'
      const completeHistory = await fetchReportHistoryRange(startIso, endExclusiveIso, scrapOnly)

      if (requestSeq === historyRequestSeqRef.current) {
        setWorkCardHistory(completeHistory)
      }

      if (scrapOnly) {
        let classQuery = supabase.from('scrap_classifications').select('*')
        if (startIso) classQuery = classQuery.gte('created_at', startIso)
        if (endExclusiveIso) classQuery = classQuery.lt('created_at', endExclusiveIso)
        const classResult = await classQuery
        if (!classResult.error && classResult.data && requestSeq === historyRequestSeqRef.current) {
          setScrapClassificationsList(classResult.data)
        }
      }

      if (scrapOnly && scrapReportSubTab === 'reasons') {
        let dbReasonsQuery = supabase.from('scrap_report_by_reason').select('*')
        if (startIso) dbReasonsQuery = dbReasonsQuery.gte('report_day', startIso)
        if (endExclusiveIso) dbReasonsQuery = dbReasonsQuery.lt('report_day', endExclusiveIso)

        let classificationsQuery = supabase.from('scrap_classifications').select('source_history_id')
        if (startIso) classificationsQuery = classificationsQuery.gte('classified_at', startIso)
        if (endExclusiveIso) classificationsQuery = classificationsQuery.lt('classified_at', endExclusiveIso)

        const dbReasonsResult = await dbReasonsQuery
        const classificationsResult = await classificationsQuery
        if (dbReasonsResult.error) throw dbReasonsResult.error
        if (classificationsResult.error) throw classificationsResult.error
        if (requestSeq === historyRequestSeqRef.current) {
          setScrapReasonsDb(dbReasonsResult.data || [])
          setClassifiedHistoryIds(new Set((classificationsResult.data || []).map(r => r.source_history_id)))
        }
      }
    } catch (err) {
      console.error("Failed to sync history range:", err)
      if (requestSeq === historyRequestSeqRef.current) {
        setHistoryLoadError(err?.message || 'Не вдалося завантажити дані за обраний період')
      }
    } finally {
      if (requestSeq === historyRequestSeqRef.current) setIsSyncing(false)
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!HISTORY_REPORT_TABS.has(activeTab)) return
      if (startDate || endDate) syncHistory(startDate, endDate)
      else setWorkCardHistory(initialHistory)
    }, 250)
    return () => clearTimeout(timer)
  }, [startDate, endDate, activeTab, scrapReportSubTab])

  const handleQuickDateSelect = (e) => {
    const val = e.target.value
    if (!val) return
    
    const today = new Date()
    const toISO = (d) => {
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const todayStr = toISO(today)
    let startStr = ''
    let endStr = todayStr

    if (val === 'today') {
      startStr = todayStr
    } else if (val === 'yesterday') {
      const yest = new Date()
      yest.setDate(yest.getDate() - 1)
      startStr = toISO(yest)
      endStr = startStr
    } else if (val === '3days') {
      const d = new Date()
      d.setDate(d.getDate() - 2)
      startStr = toISO(d)
    } else if (val === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 6)
      startStr = toISO(d)
    } else if (val === 'month') {
      const d = new Date()
      d.setMonth(d.getMonth() - 1)
      startStr = toISO(d)
    } else if (val === 'quarter') {
      const d = new Date()
      d.setMonth(d.getMonth() - 3)
      startStr = toISO(d)
    } else if (val === 'halfyear') {
      const d = new Date()
      d.setMonth(d.getMonth() - 6)
      startStr = toISO(d)
    } else if (val === 'year') {
      const d = new Date()
      d.setFullYear(d.getFullYear() - 1)
      startStr = toISO(d)
    }

    setStartDate(startStr)
    setEndDate(endStr)
    setQuickPeriod(val)
  }

  const filterByDate = useCallback((dateString, altDateString = null) => {
    if (!startDate && !endDate) return true
    const targetDate = dateString || altDateString
    if (!targetDate) return true
    const d = new Date(targetDate)
    
    if (startDate) {
      const s = new Date(startDate)
      s.setHours(0,0,0,0)
      if (d < s) return false
    }
    if (endDate) {
      const e = new Date(endDate)
      e.setHours(23,59,59,999)
      if (d > e) return false
    }
    
    return true
  }, [startDate, endDate])

  // Sub-hooks per report type
  const warehouseReport = useWarehouseReport(inventory, nomenclatures)

  const { employeeStats } = useEmployeeReport({
    systemUsers,
    workCardHistory,
    filterByDate,
    selectedShiftFilter,
    selectedEmployeeFilter,
    searchQuery
  })

  const { scrapStats, scrapReasonsStats } = useScrapReport({
    workCardHistory,
    scrapClassificationsList,
    scrapReasonsDb,
    classifiedHistoryIds,
    nomenclatures,
    filterByDate,
    selectedShiftFilter,
    selectedEmployeeFilter,
    searchQuery
  })

  const { supplyStats } = useSuppliesReport({
    receptionDocs,
    requests,
    inventory,
    nomenclatures,
    filterByDate,
    searchQuery,
    normalize
  })

  const { cuttersStats } = useCuttersReport({
    receptionDocs,
    requests,
    workCardHistory,
    inventory,
    nomenclatures,
    filterByDate,
    selectedShiftFilter,
    selectedEmployeeFilter,
    searchQuery
  })

  // General Stats
  const generalStats = useMemo(() => {
    const filteredTasks = tasks.filter(t => filterByDate(t.created_at))
    const filteredOrders = orders.filter(o => filterByDate(o.created_at))
    
    const totalSets = filteredTasks.reduce((acc, t) => acc + (Number(t.planned_sets) || 0), 0)
    const completedTasks = filteredTasks.filter(t => t.status === 'completed').length
    
    const producedParts = workCardHistory
      .filter(h => filterByDate(h.completed_at))
      .reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0)

    return {
      totalOrders: filteredOrders.length,
      activeOrders: filteredOrders.filter(o => o.status !== 'completed').length,
      totalTasks: filteredTasks.length,
      completedTasks,
      totalSets,
      producedParts
    }
  }, [tasks, orders, workCardHistory, filterByDate])

  return {
    inventory,
    tasks,
    orders,
    nomenclatures,
    receptionDocs,
    requests,
    activeTab,
    setActiveTab,
    scrapReportSubTab,
    setScrapReportSubTab,
    searchQuery,
    setSearchQuery,
    quickPeriod,
    setQuickPeriod,
    archiveLoaded,
    archiveLoading,
    allArchiveTasks,
    archiveSearch,
    setArchiveSearch,
    archiveStatusFilter,
    setArchiveStatusFilter,
    loadArchive,
    filteredArchiveTasks,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    workCardHistory,
    isSyncing,
    historyLoadError,
    selectedShiftFilter,
    setSelectedShiftFilter,
    selectedEmployeeFilter,
    setSelectedEmployeeFilter,
    uniqueOperators,
    handleQuickDateSelect,
    filterByDate,
    ...warehouseReport,
    employeeStats,
    scrapStats,
    scrapReasonsStats,
    generalStats,
    supplyStats,
    cuttersStats,
    archiveTotalCount,
    archiveTotalPages,
    archivePage,
    setArchivePage,
    setArchiveLoaded,
    setAllArchiveTasks
  }
}
