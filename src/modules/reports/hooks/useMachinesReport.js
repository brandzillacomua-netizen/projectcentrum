import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../../../supabase.js'
import { isCardAssignedToMachine, parseMaintenanceLog } from '../../Machines/utils/machineDashboardUtils.js'

export const formatDurationSec = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total === 0) return '0хв'
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hours > 0) {
    return minutes > 0 ? `${hours}г ${minutes}хв` : `${hours}г`
  }
  if (minutes > 0) {
    return `${minutes}хв`
  }
  return `${secs}с`
}

/**
 * Compare two machine records from smallest ordinal sequence number to largest.
 * Handles alphanumeric codes such as "Ф2", "Ф12", "2", "10", placing machines
 * without a sequence number at the end and breaking ties naturally.
 */
export const compareMachinesBySequenceNumber = (a, b) => {
  const seqA = String(a?.sequence_number || '').trim()
  const seqB = String(b?.sequence_number || '').trim()

  if (!seqA && !seqB) {
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'uk-UA', { numeric: true, sensitivity: 'base' })
  }
  if (!seqA) return 1
  if (!seqB) return -1

  const numMatchA = seqA.match(/\d+/)
  const numMatchB = seqB.match(/\d+/)

  if (numMatchA && numMatchB) {
    const numDiff = Number(numMatchA[0]) - Number(numMatchB[0])
    if (numDiff !== 0) return numDiff
  } else if (numMatchA) {
    return -1
  } else if (numMatchB) {
    return 1
  }

  const seqDiff = seqA.localeCompare(seqB, 'uk-UA', { numeric: true, sensitivity: 'base' })
  if (seqDiff !== 0) return seqDiff

  return String(a?.name || '').localeCompare(String(b?.name || ''), 'uk-UA', { numeric: true, sensitivity: 'base' })
}

/**
 * Filter out non-person entities such as "Команда", "Буфер", "Система", "Не вказано",
 * because only actual individual CNC machine operators should be attributed to machines.
 */
export const isCuttingOperator = (name) => {
  if (!name) return false
  const clean = String(name).trim().toLowerCase()
  if (
    !clean ||
    clean === '—' ||
    clean === '-' ||
    clean === 'null' ||
    clean === 'undefined' ||
    clean === 'не вказано' ||
    clean === 'невідомо' ||
    clean === 'команда' ||
    clean === 'буфер' ||
    clean === 'система' ||
    clean === 'робот'
  ) {
    return false
  }
  if (clean.startsWith('команда')) return false
  if (clean.startsWith('буфер')) return false
  if (clean.startsWith('цех')) return false
  return true
}

/**
 * Check if the history record is specifically an actual Cutting operation.
 * Excludes subsequent stages (галтовка, сортування, пресування, малярка)
 * as well as technical buffers and shift handovers ("Буфер Розкрій", "Розкрій (перезмінка)").
 */
export const isCuttingStage = (stageName) => {
  if (!stageName) return false
  const s = String(stageName).trim().toLowerCase()
  if (s !== 'розкрій' && !s.startsWith('розкрій')) return false
  if (
    s.includes('буфер') ||
    s.includes('зупинк') ||
    s.includes('пауз') ||
    s.includes('перезмінк') ||
    s.includes('переміщен') ||
    s.includes('вкя') ||
    s.includes('склад')
  ) {
    return false
  }
  return true
}

/**
 * Check if the history record is specifically a Cutting Pause event.
 */
export const isCuttingPauseStage = (h) => {
  const stage = String(h?.stage_name || '').trim().toLowerCase()
  const info = String(h?.card_info || '')
  if (stage === 'розкрій (зупинка)') return true
  if (stage.includes('розкрій') && !stage.includes('буфер') && (info.includes('[PAUSED_WORK_LOG]') || info.includes('[PAUSED:'))) return true
  return false
}

export function useMachinesReport({
  machines = [],
  workCardHistory = [],
  workCards = [],
  orders = [],
  tasks = [],
  nomenclatures = [],
  filterByDate,
  selectedShiftFilter = 'all',
  searchQuery = '',
  startDate,
  endDate
}) {
  const [selectedMachineType, setSelectedMachineType] = useState('all')
  const [selectedMachineId, setSelectedMachineId] = useState('all')
  const [maintenanceLogs, setMaintenanceLogs] = useState([])
  const [loadingMaintenance, setLoadingMaintenance] = useState(false)
  const [dbMachines, setDbMachines] = useState([])

  // Fallback: If machines is not loaded from context, fetch directly from Supabase
  useEffect(() => {
    if (Array.isArray(machines) && machines.length > 0) return
    let active = true
    supabase
      .from('machines')
      .select('*')
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (!error && Array.isArray(data) && active) {
          setDbMachines(data)
        }
      })
      .catch(err => {
        console.warn('[useMachinesReport] Failed to fetch machines directly:', err)
      })
    return () => { active = false }
  }, [machines])

  const safeMachines = useMemo(() => {
    if (Array.isArray(machines) && machines.length > 0) return machines
    if (Array.isArray(dbMachines) && dbMachines.length > 0) return dbMachines
    return Array.isArray(machines) ? machines : []
  }, [machines, dbMachines])

  // 1. Fetch machine maintenance logs for the selected date range
  const loadMaintenanceLogs = useCallback(async () => {
    setLoadingMaintenance(true)
    try {
      let query = supabase
        .from('machine_maintenance_logs')
        .select('*')
        .order('triggered_at', { ascending: false })

      if (startDate) {
        query = query.gte('triggered_at', `${startDate}T00:00:00.000Z`)
      }
      if (endDate) {
        query = query.lte('triggered_at', `${endDate}T23:59:59.999Z`)
      }

      const { data, error } = await query
      if (error) throw error
      setMaintenanceLogs((data || []).map(parseMaintenanceLog))
    } catch (err) {
      console.warn('[useMachinesReport] Error loading maintenance logs:', err)
      setMaintenanceLogs([])
    } finally {
      setLoadingMaintenance(false)
    }
  }, [startDate, endDate])

  useEffect(() => {
    loadMaintenanceLogs()
  }, [loadMaintenanceLogs])

  // 2. Unique Machine Types for filter
  const machineTypes = useMemo(() => {
    const set = new Set()
    ;(safeMachines || []).forEach(m => {
      if (m && m.type) set.add(m.type.trim())
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'uk-UA'))
  }, [safeMachines])

  // 3. Filtered machines list based on selectedMachineType, sorted from smallest sequence_number
  const filteredMachines = useMemo(() => {
    return (safeMachines || [])
      .filter(m => {
        if (!m) return false
        if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) {
          return false
        }
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          const nameMatch = (m.name || '').toLowerCase().includes(q)
          const numMatch = (m.sequence_number || '').toLowerCase().includes(q)
          const typeMatch = (m.type || '').toLowerCase().includes(q)
          const invMatch = (m.inventory_no || '').toLowerCase().includes(q)
          return nameMatch || numMatch || typeMatch || invMatch
        }
        return true
      })
      .sort(compareMachinesBySequenceNumber)
  }, [safeMachines, selectedMachineType, searchQuery])

  // 4. Precompute helper maps
  const ordersById = useMemo(() => new Map((Array.isArray(orders) ? orders : []).map(o => [String(o.id), o])), [orders])
  const tasksById = useMemo(() => new Map((Array.isArray(tasks) ? tasks : []).map(t => [String(t.id), t])), [tasks])
  const nomsById = useMemo(() => new Map((Array.isArray(nomenclatures) ? nomenclatures : []).map(n => [String(n.id), n])), [nomenclatures])
  const workCardsById = useMemo(() => new Map((Array.isArray(workCards) ? workCards : []).map(w => [String(w.id), w])), [workCards])

  // 5. Build Comprehensive Machine Analytics
  const machineAnalytics = useMemo(() => {
    const safeHistory = Array.isArray(workCardHistory) ? workCardHistory : []
    const safeActiveCards = Array.isArray(workCards) ? workCards : []
    const safeLogs = Array.isArray(maintenanceLogs) ? maintenanceLogs : []
    const safeMList = Array.isArray(safeMachines) ? safeMachines : []

    // A. Parse pauses from workCardHistory (specifically cutting stops)
    const pauseEvents = safeHistory.filter(h => {
      if (!isCuttingPauseStage(h)) return false
      if (selectedShiftFilter !== 'all' && h?.shift_name && h.shift_name !== selectedShiftFilter) return false
      return typeof filterByDate === 'function' ? filterByDate(h?.completed_at || h?.started_at || h?.created_at) : true
    })

    // B. Parse cutting work records (strictly actual cutting stages, excluding buffers, subsequent operations, etc.)
    const cuttingHistoryRows = safeHistory.filter(h => {
      if (!isCuttingStage(h?.stage_name)) return false
      if (selectedShiftFilter !== 'all' && h?.shift_name && h.shift_name !== selectedShiftFilter) return false
      return typeof filterByDate === 'function' ? filterByDate(h?.completed_at || h?.started_at || h?.created_at) : true
    })

    // C. Group per machine
    const statsByMachine = new Map()

    safeMList.forEach(m => {
      if (!m || !m.id) return
      const seqStr = String(m.sequence_number || '').trim()
      const formattedSeq = seqStr ? (seqStr.startsWith('№') ? seqStr : `№${seqStr}`) : ''
      const fullName = formattedSeq && !m.name.includes(seqStr) ? `${m.name} ${formattedSeq}` : m.name

      statsByMachine.set(String(m.id), {
        machine: m,
        id: m.id,
        name: m.name,
        sequence_number: m.sequence_number || '',
        fullName,
        type: m.type || '—',
        status: m.status || 'idle',
        totalWorkSec: 0,
        totalPauseSec: 0,
        pauseCount: 0,
        pauseReasons: {},
        cardsCount: 0,
        producedQty: 0,
        scrapQty: 0,
        sheetsCount: 0,
        operators: new Set(),
        maintenanceLogs: [],
        maintenanceCountsByType: {},
        cards: [] // Chronological cards for this machine
      })
    })

    // Associate maintenance logs with machines
    safeLogs.forEach(log => {
      if (!log || !log.machine_id) return
      const mStat = statsByMachine.get(String(log.machine_id))
      if (mStat) {
        log.machineName = mStat.fullName || mStat.name
        log.machineSequenceNumber = mStat.sequence_number
        log.machineType = mStat.type
        mStat.maintenanceLogs.push(log)
        const mType = log.maintenance_type || 'Обслуговування'
        mStat.maintenanceCountsByType[mType] = (mStat.maintenanceCountsByType[mType] || 0) + 1
      }
    })

    // Associate pause events with machines
    pauseEvents.forEach(p => {
      const targetMachine = safeMList.find(m => isCardAssignedToMachine(p, m))
      if (!targetMachine) return
      const mStat = statsByMachine.get(String(targetMachine.id))
      if (!mStat) return

      let durSec = 0
      if (p.started_at && p.completed_at) {
        durSec = Math.max(0, Math.round((new Date(p.completed_at) - new Date(p.started_at)) / 1000))
      }
      mStat.totalPauseSec += durSec
      mStat.pauseCount += 1

      // Extract reason text
      let reason = 'Без причини'
      const matchReason = (p.card_info || '').match(/\[REASON:([^\]]+)\]/i) || (p.card_info || '').match(/Причина зупинки:\s*([^\[]+)/i)
      if (matchReason && matchReason[1]) {
        reason = matchReason[1].trim()
      } else if (p.card_info && !p.card_info.startsWith('[')) {
        reason = p.card_info.trim()
      }
      mStat.pauseReasons[reason] = (mStat.pauseReasons[reason] || 0) + durSec

      if (isCuttingOperator(p.operator_name)) {
        mStat.operators.add(p.operator_name.trim())
      }
    })

    // Associate cutting history cards with machines
    const cardsGroupedByMachineAndCard = new Map()

    cuttingHistoryRows.forEach(h => {
      const targetMachine = safeMList.find(m => isCardAssignedToMachine(h, m))
      if (!targetMachine) return
      const mStat = statsByMachine.get(String(targetMachine.id))
      if (!mStat) return

      const cardId = String(h.card_id || h.id)
      const existing = cardsGroupedByMachineAndCard.get(`${mStat.id}_${cardId}`)

      let workSec = 0
      if (h.started_at && h.completed_at) {
        workSec = Math.max(0, Math.round((new Date(h.completed_at) - new Date(h.started_at)) / 1000))
      }

      // Sheets from card_info or actual_sheets
      let cardSheets = 0
      const sheetsMatch = (h.card_info || '').match(/\[SHEETS:(\d+(?:[.,]\d+)?)\]/i) || (h.card_info || '').match(/\((\d+(?:[.,]\d+)?)\s*л\.?\)/i)
      if (sheetsMatch && sheetsMatch[1]) {
        cardSheets = parseFloat(sheetsMatch[1].replace(',', '.'))
      }

      const opName = isCuttingOperator(h.operator_name) ? h.operator_name.trim() : null

      if (opName) mStat.operators.add(opName)

      if (!existing) {
        const realCard = workCardsById.get(cardId)
        const actualCardInfo = realCard?.card_info || h.card_info || ''

        const item = {
          id: h.id,
          card_id: cardId,
          machine_id: mStat.id,
          machineName: mStat.fullName || mStat.name,
          machineSequenceNumber: mStat.sequence_number,
          machineType: mStat.type,
          task_id: h.task_id,
          nomenclature_id: h.nomenclature_id,
          operator_name: opName || 'Не вказано',
          operators: opName ? [opName] : [],
          stage_name: 'Розкрій',
          started_at: h.started_at,
          completed_at: h.completed_at,
          created_at: h.created_at,
          workSec,
          pauseSec: 0,
          pauseReasons: [],
          qty_completed: Number(h.qty_completed) || 0,
          scrap_qty: Number(h.scrap_qty) || 0,
          sheets: cardSheets,
          card_info: actualCardInfo,
          is_active: false
        }
        cardsGroupedByMachineAndCard.set(`${mStat.id}_${cardId}`, item)
        mStat.cards.push(item)
      } else {
        existing.workSec += workSec
        existing.qty_completed = Math.max(existing.qty_completed, Number(h.qty_completed) || 0)
        existing.scrap_qty = Math.max(existing.scrap_qty, Number(h.scrap_qty) || 0)
        if (opName) {
          if (!existing.operators.includes(opName)) {
            existing.operators.push(opName)
          }
          if (existing.operator_name === 'Не вказано') {
            existing.operator_name = opName
          }
        }
      }

      mStat.totalWorkSec += workSec
      mStat.producedQty += Number(h.qty_completed) || 0
      mStat.scrapQty += Number(h.scrap_qty) || 0
      mStat.sheetsCount += cardSheets
    })

    // Also link pauses to specific cards inside mStat.cards
    pauseEvents.forEach(p => {
      const targetMachine = safeMList.find(m => isCardAssignedToMachine(p, m))
      if (!targetMachine) return
      const mStat = statsByMachine.get(String(targetMachine.id))
      if (!mStat) return

      const cardId = String(p.card_id || '')
      if (cardId) {
        const cardItem = mStat.cards.find(c => c.card_id === cardId)
        if (cardItem) {
          let durSec = 0
          if (p.started_at && p.completed_at) {
            durSec = Math.max(0, Math.round((new Date(p.completed_at) - new Date(p.started_at)) / 1000))
          }
          cardItem.pauseSec += durSec

          let reason = 'Без причини'
          const matchReason = (p.card_info || '').match(/\[REASON:([^\]]+)\]/i) || (p.card_info || '').match(/Причина зупинки:\s*([^\[]+)/i)
          if (matchReason && matchReason[1]) reason = matchReason[1].trim()
          else if (p.card_info && !p.card_info.startsWith('[')) reason = p.card_info.trim()

          cardItem.pauseReasons.push({ reason, durationSec: durSec, started_at: p.started_at, completed_at: p.completed_at })
        }
      }
    })

    // Also check currently active cards in workCards (strictly cutting operation)
    const nowIso = new Date().toISOString()
    const nowMs = Date.now()

    safeActiveCards.forEach(c => {
      const op = String(c?.operation || '').trim().toLowerCase()
      // Only active cards whose current operation is strictly 'Розкрій'
      if (op !== 'розкрій') return
      if (!['in-progress', 'paused'].includes(c?.status)) return

      const targetMachine = safeMList.find(m => isCardAssignedToMachine(c, m))
      if (!targetMachine) return
      const mStat = statsByMachine.get(String(targetMachine.id))
      if (!mStat) return

      const isCurrentlyPaused = c.status === 'paused'
      const startMs = c.started_at ? new Date(c.started_at).getTime() : nowMs

      let activeWorkSec = 0
      let activePauseSec = 0
      let currentPauseReason = ''

      if (isCurrentlyPaused) {
        const pausedAtStr = c.card_info?.match(/\[PAUSED_AT:([^\]]+)\]/)?.[1]
        const pausedAtMs = pausedAtStr ? new Date(pausedAtStr).getTime() : startMs
        currentPauseReason = c.card_info?.match(/\[PAUSED:([^\]]+)\]/)?.[1] || 'На паузі'
        activePauseSec = Math.max(0, Math.round((nowMs - pausedAtMs) / 1000))
        activeWorkSec = Math.max(0, Math.round((pausedAtMs - startMs) / 1000))

        mStat.totalPauseSec += activePauseSec
        mStat.pauseCount += 1
        mStat.pauseReasons[currentPauseReason] = (mStat.pauseReasons[currentPauseReason] || 0) + activePauseSec
      } else {
        activeWorkSec = Math.max(0, Math.round((nowMs - startMs) / 1000))
      }

      mStat.totalWorkSec += activeWorkSec

      const opName = isCuttingOperator(c.operator_name) ? c.operator_name.trim() : null
      if (opName) mStat.operators.add(opName)

      let cardSheets = Number(c.actual_sheets) || 0
      if (!cardSheets) {
        const mSheets = (c.card_info || '').match(/\[SHEETS:(\d+(?:[.,]\d+)?)\]/i) || (c.card_info || '').match(/\((\d+(?:[.,]\d+)?)\s*л\.?\)/i)
        if (mSheets && mSheets[1]) cardSheets = parseFloat(mSheets[1].replace(',', '.'))
      }

      mStat.cards.push({
        id: c.id,
        card_id: c.id,
        machine_id: mStat.id,
        machineName: mStat.fullName || mStat.name,
        machineSequenceNumber: mStat.sequence_number,
        machineType: mStat.type,
        task_id: c.task_id,
        nomenclature_id: c.nomenclature_id,
        operator_name: opName || 'Не вказано',
        operators: opName ? [opName] : [],
        stage_name: 'Розкрій',
        started_at: c.started_at || nowIso,
        completed_at: null,
        created_at: c.created_at,
        workSec: activeWorkSec,
        pauseSec: activePauseSec,
        pauseReasons: currentPauseReason ? [{ reason: currentPauseReason, durationSec: activePauseSec, started_at: c.started_at, completed_at: null }] : [],
        qty_completed: Number(c.quantity) || 0,
        scrap_qty: 0,
        sheets: cardSheets,
        card_info: c.card_info || '',
        is_active: true,
        is_paused: isCurrentlyPaused,
        current_status: c.status
      })
    })

    // Compute cards count and sort cards descending by date
    statsByMachine.forEach(mStat => {
      mStat.cardsCount = mStat.cards.length
      mStat.operatorsList = Array.from(mStat.operators)
        .filter(isCuttingOperator)
        .sort((a, b) => a.localeCompare(b, 'uk-UA'))
      mStat.cards.sort((a, b) => {
        const tA = new Date(a.completed_at || a.started_at || a.created_at || 0).getTime()
        const tB = new Date(b.completed_at || b.started_at || b.created_at || 0).getTime()
        return tB - tA
      })
    })

    return Array.from(statsByMachine.values())
  }, [safeMachines, workCardHistory, workCards, maintenanceLogs, filterByDate, selectedShiftFilter])

  // 6. Selected Machine Detail or All
  const selectedMachineStat = useMemo(() => {
    if (selectedMachineId === 'all') return null
    return (machineAnalytics || []).find(m => String(m.id) === String(selectedMachineId)) || null
  }, [machineAnalytics, selectedMachineId])

  // 7. Overall Summary Totals across all currently filtered machines
  const totals = useMemo(() => {
    const list = selectedMachineStat ? [selectedMachineStat] : (machineAnalytics || []).filter(m => {
      if (selectedMachineType !== 'all' && (m.type || '').trim() !== selectedMachineType) return false
      return true
    })

    let totalWorkSec = 0
    let totalPauseSec = 0
    let totalPauseCount = 0
    let totalCardsCount = 0
    let totalProducedQty = 0
    let totalScrapQty = 0
    let totalSheets = 0
    let totalMaintenanceCount = 0
    const allOperators = new Set()
    const globalPauseReasons = {}
    const globalMaintenanceTypes = {}

    list.forEach(m => {
      totalWorkSec += m.totalWorkSec
      totalPauseSec += m.totalPauseSec
      totalPauseCount += m.pauseCount
      totalCardsCount += m.cardsCount
      totalProducedQty += m.producedQty
      totalScrapQty += m.scrapQty
      totalSheets += m.sheetsCount
      totalMaintenanceCount += (m.maintenanceLogs || []).length

      ;(m.operatorsList || []).forEach(op => {
        if (isCuttingOperator(op)) allOperators.add(op)
      })

      Object.entries(m.pauseReasons || {}).forEach(([reason, sec]) => {
        globalPauseReasons[reason] = (globalPauseReasons[reason] || 0) + sec
      })

      Object.entries(m.maintenanceCountsByType || {}).forEach(([mType, cnt]) => {
        globalMaintenanceTypes[mType] = (globalMaintenanceTypes[mType] || 0) + cnt
      })
    })

    const totalActiveTime = totalWorkSec + totalPauseSec
    const pausePercentage = totalActiveTime > 0 ? ((totalPauseSec / totalActiveTime) * 100).toFixed(1) : 0

    return {
      totalWorkSec,
      totalPauseSec,
      totalPauseCount,
      totalCardsCount,
      totalProducedQty,
      totalScrapQty,
      totalSheets,
      totalMaintenanceCount,
      uniqueOperatorsCount: allOperators.size,
      operatorsList: Array.from(allOperators)
        .filter(isCuttingOperator)
        .sort((a, b) => a.localeCompare(b, 'uk-UA')),
      pausePercentage,
      globalPauseReasons,
      globalMaintenanceTypes
    }
  }, [machineAnalytics, selectedMachineStat, selectedMachineType])

  return {
    machineAnalytics,
    filteredMachines,
    machineTypes,
    selectedMachineType,
    setSelectedMachineType,
    selectedMachineId,
    setSelectedMachineId,
    selectedMachineStat,
    totals,
    maintenanceLogs,
    loadingMaintenance,
    loadMaintenanceLogs,
    ordersById,
    tasksById,
    nomsById,
    workCardsById
  }
}
