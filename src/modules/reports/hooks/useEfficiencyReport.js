import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../../../supabase.js'
import { useStore } from '../../../store/index.js'
import {
  parseLastOpTag,
  buildOrderedOperationsList,
  sliceOperationsBetween,
  calculateSlicePlannedMinutes,
  calculateEfficiency,
  resolveMachineTypeFromCard,
  getCardSheetsCount,
  getCardCuttingPlanSeconds
} from '../../../utils/cuttingTimeUtils.js'
import { matchesOperator } from './useEmployeeReport.js'

/**
 * Checks if a work_card_history record represents an actual cutting work session
 * (either a shift handover session or completed cutting operation).
 */
export const isCuttingHistorySession = (h) => {
  if (!h) return false
  const stage = String(h.stage_name || h.operation || '').trim()
  const stageLower = stage.toLowerCase()

  if (!stageLower.startsWith('розкрій')) return false

  // Exclude technical buffers and pause events
  if (
    stageLower.includes('буфер') ||
    stageLower.includes('зупинк') ||
    stageLower.includes('пауз') ||
    stageLower.includes('вкя') ||
    stageLower.includes('склад')
  ) {
    return false
  }

  const info = String(h.card_info || '')
  if (info.includes('[PAUSED_WORK_LOG]') || info.includes('[PAUSED:')) {
    return false
  }

  return true
}

export function useEfficiencyReport({
  workCardHistory = [],
  nomenclatures = [],
  machines = [],
  workCards = [],
  tasks = [],
  orders = [],
  filterByDate,
  selectedShiftFilter = 'all',
  selectedEmployeeFilter = 'all',
  searchQuery = '',
  startDate,
  endDate
}) {
  const storeMachineOps = useStore(state => state.machineOperations) || []
  const [machineOperations, setMachineOperations] = useState(storeMachineOps)
  const [cuttingTimingsDb, setCuttingTimingsDb] = useState([])
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const fetchedRef = useRef(false)

  // 1. Fetch machine_operations & cutting_operation_timings
  useEffect(() => {
    let isCancelled = false

    const loadMetadata = async () => {
      setIsLoadingMetadata(true)
      try {
        const [mOpsRes, timingsRes] = await Promise.all([
          storeMachineOps.length > 0
            ? Promise.resolve({ data: storeMachineOps })
            : supabase.from('machine_operations').select('*'),
          supabase.from('cutting_operation_timings').select('*')
        ])

        if (!isCancelled) {
          if (mOpsRes?.data) setMachineOperations(mOpsRes.data)
          if (timingsRes?.data) setCuttingTimingsDb(timingsRes.data)
        }
      } catch (err) {
        console.warn('[useEfficiencyReport] Error loading metadata:', err)
      } finally {
        if (!isCancelled) setIsLoadingMetadata(false)
      }
    }

    if (!fetchedRef.current) {
      fetchedRef.current = true
      loadMetadata()
    }
  }, [storeMachineOps])

  // Lookup maps
  const nomsById = useMemo(() => {
    const map = new Map()
    nomenclatures.forEach(n => {
      if (n?.id) map.set(String(n.id), n)
      if (Array.isArray(n?.legacy_ids)) {
        n.legacy_ids.forEach(lid => map.set(String(lid), n))
      }
    })
    return map
  }, [nomenclatures])

  const cardsById = useMemo(() => {
    const map = new Map()
    workCards.forEach(c => {
      if (c?.id) map.set(String(c.id), c)
    })
    return map
  }, [workCards])

  const tasksById = useMemo(() => {
    const map = new Map()
    tasks.forEach(t => {
      if (t?.id) map.set(String(t.id), t)
    })
    return map
  }, [tasks])

  const ordersById = useMemo(() => {
    const map = new Map()
    orders.forEach(o => {
      if (o?.id) map.set(String(o.id), o)
    })
    return map
  }, [orders])

  // Timings map: key = `${nomenclature_id}_${machine_type.toLowerCase()}` -> { [opName]: { [sheets]: minutes } }
  const timingsMap = useMemo(() => {
    const map = new Map()

    // A. From DB cutting_operation_timings table
    cuttingTimingsDb.forEach(t => {
      if (!t.nomenclature_id) return
      const mType = String(t.machine_type || '').toLowerCase().trim()
      const key = `${t.nomenclature_id}_${mType}`
      if (!map.has(key)) map.set(key, {})
      const opObj = map.get(key)
      if (!opObj[t.operation_name]) opObj[t.operation_name] = {}
      opObj[t.operation_name][String(t.sheet_count)] = Number(t.duration_minutes) || 0
    })

    // B. Overlay/fallback from nomenclatures.rule_params.operation_timings
    nomenclatures.forEach(n => {
      const opTimings = n?.rule_params?.operation_timings
      if (opTimings && typeof opTimings === 'object') {
        Object.entries(opTimings).forEach(([mType, ops]) => {
          const mNorm = String(mType || '').toLowerCase().trim()
          const key = `${n.id}_${mNorm}`
          if (!map.has(key)) map.set(key, {})
          const existingOps = map.get(key)
          Object.entries(ops || {}).forEach(([opName, sheetsMap]) => {
            if (!existingOps[opName]) existingOps[opName] = {}
            Object.entries(sheetsMap || {}).forEach(([s, mins]) => {
              if (existingOps[opName][s] === undefined) {
                existingOps[opName][s] = Number(mins) || 0
              }
            })
          })
        })
      }
    })

    return map
  }, [cuttingTimingsDb, nomenclatures])

  // Machine operations map by nomenclature_id
  const machineOpsByNom = useMemo(() => {
    const map = new Map()
    machineOperations.forEach(mo => {
      if (!mo.nomenclature_id) return
      const nomId = String(mo.nomenclature_id)
      if (!map.has(nomId)) map.set(nomId, [])
      map.get(nomId).push(mo)
    })
    return map
  }, [machineOperations])

  // 2. Main calculation pipeline
  const {
    allSessions,
    operatorsList,
    partsComparison,
    shiftChangesLog,
    totals
  } = useMemo(() => {
    // Step A: Filter cutting history rows by date
    const safeHistory = Array.isArray(workCardHistory) ? workCardHistory : []
    const cuttingRows = safeHistory.filter(h => {
      if (!isCuttingHistorySession(h)) return false
      return typeof filterByDate === 'function'
        ? filterByDate(h.completed_at || h.started_at || h.created_at)
        : true
    })

    // Step B: Group rows by card_id to reconstruct chronological work sessions
    const rowsByCard = new Map()
    cuttingRows.forEach(h => {
      const cardKey = String(h.card_id || h.id)
      if (!rowsByCard.has(cardKey)) rowsByCard.set(cardKey, [])
      rowsByCard.get(cardKey).push(h)
    })

    const processedSessions = []
    const shiftChanges = []

    rowsByCard.forEach((cardRows, cardId) => {
      // Sort chronologically ascending
      cardRows.sort((a, b) => {
        const timeA = new Date(a.started_at || a.created_at || a.completed_at || 0).getTime()
        const timeB = new Date(b.started_at || b.created_at || b.completed_at || 0).getTime()
        return timeA - timeB
      })

      const sampleRow = cardRows[0]
      const card = cardsById.get(cardId)
      const nomId = sampleRow.nomenclature_id || card?.nomenclature_id
      const nom = nomId ? nomsById.get(String(nomId)) : null
      const task = card?.task_id ? tasksById.get(String(card.task_id)) : null
      const order = task?.order_id ? ordersById.get(String(task.order_id)) : null

      // Resolve machine and machine operations configuration
      const mType = resolveMachineTypeFromCard(card || sampleRow, machines) || 'Стандартний ЧПК'
      const mTypeNorm = mType.toLowerCase().trim()

      const nomOpsList = nomId ? (machineOpsByNom.get(String(nomId)) || []) : []
      const matchedMachineOp = nomOpsList.find(o => {
        const oType = String(o.machine_type || '').toLowerCase().trim()
        return oType === mTypeNorm || oType.includes(mTypeNorm) || mTypeNorm.includes(oType)
      }) || nomOpsList[0] || null

      const orderedOps = buildOrderedOperationsList(matchedMachineOp)

      // Resolve timings map for this nom + machine
      const timingsKey = `${nomId}_${mTypeNorm}`
      const timingsForMachine = timingsMap.get(timingsKey) || (nomId ? (timingsMap.get(`${nomId}_`) || {}) : {})

      // Base card sheets count
      const baseCardSheets = getCardSheetsCount(card || sampleRow, nom)

      let previousEndOp = null

      cardRows.forEach((h, idx) => {
        const isHandover = String(h.stage_name || '').includes('перезмінка')
        const lastOpParsed = parseLastOpTag(h.card_info)

        // Target sheets for this session: from tag or from card
        const rawSheet = lastOpParsed?.sheet
        const parsedSheet = rawSheet && !isNaN(Number(rawSheet)) && Number(rawSheet) > 0 ? Number(rawSheet) : null
        const sessionSheets = parsedSheet || (baseCardSheets && !isNaN(baseCardSheets) && baseCardSheets > 0 ? baseCardSheets : 1)

        // Current session end operation
        let currentEndOp = null
        if (isHandover && lastOpParsed?.operation) {
          currentEndOp = lastOpParsed.operation
        } else if (!isHandover) {
          // Final completion of card: ends at the very last operation
          currentEndOp = null
        }

        // Slice of operations performed in this session
        const opsSlice = sliceOperationsBetween(orderedOps, previousEndOp, currentEndOp)

        // Calculate Plan strictly from new operation timings (cutting_operation_timings / rule_params.operation_timings)
        let planMinutes = 0
        if (opsSlice.length > 0 && Object.keys(timingsForMachine).length > 0) {
          planMinutes = calculateSlicePlannedMinutes(opsSlice, timingsForMachine, sessionSheets)
        }

        // Calculate Fact in minutes
        let factMinutes = 0
        if (h.started_at && h.completed_at) {
          const diffMs = new Date(h.completed_at).getTime() - new Date(h.started_at).getTime()
          factMinutes = Math.max(1, Math.round(diffMs / 60000))
        } else {
          factMinutes = Number(h.duration_mins || h.working_time_mins || 0) || 1
        }

        // If fact duration is an extreme anomaly (> 24 hours), clamp for KPI safety
        const isAnomaly = factMinutes > 1440
        const effectiveFact = isAnomaly ? 1440 : factMinutes

        const hasPlan = planMinutes > 0
        const efficiency = hasPlan ? calculateEfficiency(planMinutes, effectiveFact) : null

        const sessionObj = {
          id: h.id || `${cardId}_${idx}`,
          cardId,
          cardCode: card?.card_number || card?.code || card?.id?.substring(0, 8) || `#${cardId}`,
          historyId: h.id,
          date: h.completed_at || h.started_at || h.created_at,
          operatorName: (h.operator_name || 'Не вказано').trim(),
          shiftName: h.shift_name || 'Без зміни',
          stageName: h.stage_name || 'Розкрій',
          isHandover,
          machineName: h.machine_name || h.machine || mType,
          machineType: mType,
          nomenclatureId: nomId,
          nomenclatureName: nom?.name || 'Невідома деталь',
          nomenclatureCode: nom?.code || nom?.article || '—',
          orderNumber: order?.order_number || '—',
          customer: order?.customer || order?.client_name || '—',
          sheetCount: sessionSheets,
          previousEndOp,
          currentEndOp: currentEndOp || (opsSlice.length > 0 ? opsSlice[opsSlice.length - 1]?.name : 'Всі операції'),
          operationsCount: opsSlice.length,
          operationsSlice: opsSlice,
          hasPlan,
          planMinutes: hasPlan ? planMinutes : 0,
          factMinutes,
          effectiveFact,
          isAnomaly,
          efficiencyPercent: efficiency ? efficiency.efficiencyPercent : null,
          deltaMinutes: efficiency ? efficiency.deltaMinutes : null,
          deltaHours: efficiency ? efficiency.deltaHours : null,
          status: efficiency ? efficiency.status : 'unrated',
          cardInfo: card?.card_info || h.card_info || '',
          card: card || { id: cardId, card_info: h.card_info }
        }

        processedSessions.push(sessionObj)

        if (isHandover) {
          // Extract replaced-by operator if available
          const replacedMatch = (h.card_info || '').match(/\[REPLACED_BY:([^\]]+)\]/i)
          const replacedBy = replacedMatch ? replacedMatch[1].trim() : 'Наступна зміна'

          shiftChanges.push({
            ...sessionObj,
            replacedBy,
            rawHandoverText: lastOpParsed?.raw || 'Перезмінка'
          })
        }

        // Update previousEndOp for next iteration
        previousEndOp = currentEndOp || (orderedOps.length > 0 ? orderedOps[orderedOps.length - 1]?.name : null)
      })
    })

    // Step C: Apply user filters (Shift, Operator, Search Query)
    const filteredSessions = processedSessions.filter(s => {
      // Shift filter
      if (selectedShiftFilter !== 'all' && s.shiftName !== selectedShiftFilter) {
        return false
      }

      // Operator filter
      if (selectedEmployeeFilter !== 'all' && !matchesOperator(s.operatorName, selectedEmployeeFilter)) {
        return false
      }

      // Search query (matches operator, nomenclature name or code, card code)
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const match =
          s.operatorName.toLowerCase().includes(q) ||
          s.nomenclatureName.toLowerCase().includes(q) ||
          s.nomenclatureCode.toLowerCase().includes(q) ||
          s.cardCode.toLowerCase().includes(q) ||
          s.machineName.toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })

    // Step D: Aggregate by Operator
    const operatorMap = new Map()
    filteredSessions.forEach(s => {
      const name = s.operatorName
      if (!operatorMap.has(name)) {
        operatorMap.set(name, {
          operatorName: name,
          shiftName: s.shiftName,
          cardsSet: new Set(),
          sessionsCount: 0,
          normedSessionsCount: 0,
          totalPlanMinutes: 0,
          totalFactMinutes: 0,
          totalWorkedFactMinutes: 0,
          sessions: [],
          partsMap: new Map()
        })
      }

      const op = operatorMap.get(name)
      op.cardsSet.add(s.cardId)
      op.sessionsCount += 1
      op.totalWorkedFactMinutes += s.effectiveFact
      op.sessions.push(s)

      if (s.hasPlan) {
        op.normedSessionsCount += 1
        op.totalPlanMinutes += s.planMinutes
        op.totalFactMinutes += s.effectiveFact
      }

      // Parts breakdown
      const partKey = s.nomenclatureId || s.nomenclatureName
      if (!op.partsMap.has(partKey)) {
        op.partsMap.set(partKey, {
          id: s.nomenclatureId,
          name: s.nomenclatureName,
          code: s.nomenclatureCode,
          runsCount: 0,
          normedRunsCount: 0,
          planMin: 0,
          factMin: 0,
          workedFactMin: 0
        })
      }
      const partStat = op.partsMap.get(partKey)
      partStat.runsCount += 1
      partStat.workedFactMin += s.effectiveFact
      if (s.hasPlan) {
        partStat.normedRunsCount += 1
        partStat.planMin += s.planMinutes
        partStat.factMin += s.effectiveFact
      }
    })

    const opList = Array.from(operatorMap.values()).map(op => {
      const totalPlanHours = Math.round((op.totalPlanMinutes / 60) * 10) / 10
      const totalFactHours = Math.round((op.totalWorkedFactMinutes / 60) * 10) / 10
      const eff = op.totalFactMinutes > 0 ? calculateEfficiency(op.totalPlanMinutes, op.totalFactMinutes) : null
      const parts = Array.from(op.partsMap.values()).map(p => ({
        ...p,
        efficiencyPercent: p.factMin > 0 ? Math.round((p.planMin / p.factMin) * 1000) / 10 : null
      }))

      return {
        operatorName: op.operatorName,
        shiftName: op.shiftName,
        cardsCount: op.cardsSet.size,
        sessionsCount: op.sessionsCount,
        normedSessionsCount: op.normedSessionsCount,
        totalPlanMinutes: Math.round(op.totalPlanMinutes * 10) / 10,
        totalFactMinutes: Math.round(op.totalWorkedFactMinutes * 10) / 10,
        totalPlanHours,
        totalFactHours,
        avgEfficiencyPercent: eff ? eff.efficiencyPercent : null,
        deltaMinutes: eff ? eff.deltaMinutes : 0,
        deltaHours: eff ? eff.deltaHours : 0,
        status: eff ? eff.status : 'unrated',
        sessions: op.sessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
        parts: parts.sort((a, b) => b.runsCount - a.runsCount)
      }
    })

    // Sort operators by Efficiency descending (unrated at the end)
    opList.sort((a, b) => {
      if (a.avgEfficiencyPercent === null && b.avgEfficiencyPercent === null) return 0
      if (a.avgEfficiencyPercent === null) return 1
      if (b.avgEfficiencyPercent === null) return -1
      return b.avgEfficiencyPercent - a.avgEfficiencyPercent
    })

    // Step E: Aggregate by Part (Nomenclature) for Head-to-Head Comparison
    const partsMap = new Map()
    filteredSessions.forEach(s => {
      const partKey = s.nomenclatureId || s.nomenclatureName
      if (!partsMap.has(partKey)) {
        partsMap.set(partKey, {
          nomenclatureId: s.nomenclatureId,
          nomenclatureName: s.nomenclatureName,
          nomenclatureCode: s.nomenclatureCode,
          totalRuns: 0,
          totalPlanMinutes: 0,
          totalFactMinutes: 0,
          operatorsMap: new Map(),
          sessions: []
        })
      }

      const p = partsMap.get(partKey)
      p.totalRuns += 1
      p.totalPlanMinutes += s.planMinutes
      p.totalFactMinutes += s.effectiveFact
      p.sessions.push(s)

      const opName = s.operatorName
      if (!p.operatorsMap.has(opName)) {
        p.operatorsMap.set(opName, {
          operatorName: opName,
          shiftName: s.shiftName,
          runsCount: 0,
          totalPlanMin: 0,
          totalFactMin: 0
        })
      }
      const opP = p.operatorsMap.get(opName)
      opP.runsCount += 1
      opP.totalPlanMin += s.planMinutes
      opP.totalFactMin += s.effectiveFact
    })

    const partsList = Array.from(partsMap.values()).map(p => {
      const operators = Array.from(p.operatorsMap.values()).map(op => {
        const eff = calculateEfficiency(op.totalPlanMin, op.totalFactMin)
        const avgFact = op.runsCount > 0 ? Math.round((op.totalFactMin / op.runsCount) * 10) / 10 : 0
        const avgPlan = op.runsCount > 0 ? Math.round((op.totalPlanMin / op.runsCount) * 10) / 10 : 0
        return {
          operatorName: op.operatorName,
          shiftName: op.shiftName,
          runsCount: op.runsCount,
          totalPlanMinutes: Math.round(op.totalPlanMin * 10) / 10,
          totalFactMinutes: Math.round(op.totalFactMin * 10) / 10,
          avgPlanMinutes: avgPlan,
          avgFactMinutes: avgFact,
          efficiencyPercent: eff.efficiencyPercent,
          deltaMinutes: eff.deltaMinutes,
          status: eff.status
        }
      })

      // Sort operators on this part by highest efficiency
      operators.sort((a, b) => b.efficiencyPercent - a.efficiencyPercent)

      const fastest = operators[0] || null
      const slowest = operators.length > 1 ? operators[operators.length - 1] : null
      const efficiencySpread = fastest && slowest
        ? Math.round((fastest.efficiencyPercent - slowest.efficiencyPercent) * 10) / 10
        : 0

      const partEff = calculateEfficiency(p.totalPlanMinutes, p.totalFactMinutes)

      return {
        nomenclatureId: p.nomenclatureId,
        nomenclatureName: p.nomenclatureName,
        nomenclatureCode: p.nomenclatureCode,
        totalRuns: p.totalRuns,
        totalPlanMinutes: Math.round(p.totalPlanMinutes * 10) / 10,
        totalFactMinutes: Math.round(p.totalFactMinutes * 10) / 10,
        overallEfficiencyPercent: partEff.efficiencyPercent,
        operators,
        fastestOperator: fastest,
        slowestOperator: slowest,
        efficiencySpread,
        sessions: p.sessions
      }
    })

    // Sort parts by total runs descending
    partsList.sort((a, b) => b.totalRuns - a.totalRuns)

    // Step F: Shop Summary Totals
    let sumPlanMin = 0
    let sumFactMin = 0
    filteredSessions.forEach(s => {
      sumPlanMin += s.planMinutes
      sumFactMin += s.effectiveFact
    })

    const overallEff = calculateEfficiency(sumPlanMin, sumFactMin)
    const uniqueCardsCount = new Set(filteredSessions.map(s => s.cardId)).size

    const topOperator = opList.find(o => o.sessionsCount >= 2) || opList[0] || null

    const totalsObj = {
      overallShopEfficiency: overallEff.efficiencyPercent,
      totalPlanMinutes: Math.round(sumPlanMin * 10) / 10,
      totalFactMinutes: Math.round(sumFactMin * 10) / 10,
      totalPlanHours: Math.round((sumPlanMin / 60) * 10) / 10,
      totalFactHours: Math.round((sumFactMin / 60) * 10) / 10,
      totalDeltaMinutes: overallEff.deltaMinutes,
      totalDeltaHours: overallEff.deltaHours,
      status: overallEff.status,
      activeOperatorsCount: opList.length,
      totalCardsCut: uniqueCardsCount,
      totalSessionsCount: filteredSessions.length,
      handoverCount: shiftChanges.length,
      topOperator
    }

    return {
      allSessions: filteredSessions,
      operatorsList: opList,
      partsComparison: partsList,
      shiftChangesLog: shiftChanges.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
      totals: totalsObj
    }
  }, [
    workCardHistory,
    filterByDate,
    cardsById,
    nomsById,
    tasksById,
    ordersById,
    machines,
    machineOpsByNom,
    timingsMap,
    selectedShiftFilter,
    selectedEmployeeFilter,
    searchQuery
  ])

  return {
    allSessions,
    operatorsList,
    partsComparison,
    shiftChangesLog,
    totals,
    isLoadingMetadata
  }
}

