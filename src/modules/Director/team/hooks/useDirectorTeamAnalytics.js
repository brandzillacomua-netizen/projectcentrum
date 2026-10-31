import { useMemo } from 'react'
import { isTechnicalHistoryStage, isNonProductionEntity } from '../../../reports/hooks/useEmployeeReport.js'

export function useDirectorTeamAnalytics({
  workCardHistory = [],
  systemUsers = [],
  nomenclatures = [],
  dateRange = '30d', // '7d' | '30d' | 'month' | 'all'
  selectedDept = 'ALL',
  searchQuery = ''
}) {
  // 1. Filter history by selected date range
  const filteredHistory = useMemo(() => {
    if (!workCardHistory || workCardHistory.length === 0) return []
    const now = new Date()
    let minTime = 0

    if (dateRange === '7d') {
      minTime = now.getTime() - 7 * 24 * 60 * 60 * 1000
    } else if (dateRange === '30d') {
      minTime = now.getTime() - 30 * 24 * 60 * 60 * 1000
    } else if (dateRange === 'month') {
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      minTime = firstOfMonth.getTime()
    } else {
      minTime = 0 // 'all'
    }

    return workCardHistory.filter(h => {
      if (!h) return false
      const rawDate = h.completed_at || h.created_at || h.started_at
      if (!rawDate) return false
      const t = new Date(rawDate).getTime()
      if (isNaN(t)) return false
      return t >= minTime
    })
  }, [workCardHistory, dateRange])

  // 2. Build User Map from systemUsers
  const userMap = useMemo(() => {
    const map = new Map()
    systemUsers.forEach(u => {
      const fullName = `${u.last_name || ''} ${u.first_name || ''}`.trim()
      if (fullName) map.set(fullName.toLowerCase(), u)
      if (u.login) map.set(u.login.toLowerCase(), u)
    })
    return map
  }, [systemUsers])

  // 3. Nomenclature map
  const nomMap = useMemo(() => {
    const map = new Map()
    nomenclatures.forEach(n => {
      if (n && n.id) map.set(String(n.id), n)
    })
    return map
  }, [nomenclatures])

  // 4. Group history by operator and calculate metrics
  const operatorsStats = useMemo(() => {
    const map = new Map()

    filteredHistory.forEach(h => {
      const rawName = String(h.operator_name || '').trim()
      if (!rawName || rawName === 'Не вказано' || rawName === '-' || rawName.toLowerCase().includes('автомат')) {
        return
      }

      // Filter out technical warehouse movements and buffers (e.g. "Склад (бронь)", "Контроль ВКЯ")
      if (isTechnicalHistoryStage(h.stage_name)) {
        return
      }

      const normName = rawName
      const u = userMap.get(normName.toLowerCase()) || {}

      // Filter out system, quality inspectors, or admin accounts from operator rankings
      if (isNonProductionEntity(normName, u, systemUsers)) {
        return
      }

      if (!map.has(normName)) {
        map.set(normName, {
          name: normName,
          user: u,
          position: u.position || 'Оператор',
          department: u.department || (h.stage_name?.includes('Цех 2') ? 'Цех №2' : 'Цех №1'),
          shift: h.shift_name || u.shift || 'Без зміни',
          activeSec: 0,
          pauseSec: 0,
          pauseCount: 0,
          producedQty: 0,
          scrapQty: 0,
          cuttersUsed: 0,
          cardsSet: new Set(),
          machinesMap: {},
          nomMap: {},
          pauseReasons: {},
          stagesMap: {}
        })
      }

      const rec = map.get(normName)
      const stage = String(h.stage_name || '').toLowerCase()
      const isPause = stage.includes('пауза') || stage.includes('зупинка')
      const s = new Date(h.started_at || h.created_at).getTime()
      const e = new Date(h.completed_at || h.started_at || h.created_at).getTime()
      const timeSpanSec = (s && e && e > s) ? Math.floor((e - s) / 1000) : 0
      const activeDuration = Number(h.duration_active_sec || h.work_seconds || timeSpanSec || 0)
      const pauseDuration = Number(h.duration_pause_sec || h.pause_seconds || (isPause ? timeSpanSec : 0) || 0)

      if (isPause) {
        rec.pauseSec += pauseDuration
        rec.pauseCount += 1
        const reason = String(h.card_info || '').replace(/.*Причина зупинки:\s*/i, '').trim() || h.pause_reason || 'Без причини'
        rec.pauseReasons[reason] = (rec.pauseReasons[reason] || 0) + pauseDuration
      } else {
        rec.activeSec += activeDuration
        const produced = Number(h.qty_completed) || 0
        const scrap = Number(h.scrap_qty) || 0
        const cutters = Number(h.cutters_used) || 0
        rec.producedQty += produced
        rec.scrapQty += scrap
        rec.cuttersUsed += cutters

        if (h.card_id) rec.cardsSet.add(String(h.card_id))

        // Machine stats
        const m = String(h.machine_name || 'Не вказано').trim()
        if (m) rec.machinesMap[m] = (rec.machinesMap[m] || 0) + produced

        // Nomenclature stats
        const nid = String(h.nomenclature_id || '')
        if (nid) {
          const nom = nomMap.get(nid)
          const nomName = nom?.name || `Арт. ${nid}`
          rec.nomMap[nomName] = (rec.nomMap[nomName] || 0) + produced
        }

        // Stage stats
        const stName = h.stage_name || 'Розкрій'
        rec.stagesMap[stName] = (rec.stagesMap[stName] || 0) + produced
      }
    })

    // Compute derived scores
    const list = Array.from(map.values()).map(op => {
      const activeHours = op.activeSec / 3600
      const pauseHours = op.pauseSec / 3600
      const totalHours = activeHours + pauseHours
      const unitsPerHour = activeHours > 0 ? Math.round(op.producedQty / activeHours) : 0
      const totalUnits = op.producedQty + op.scrapQty
      const scrapRate = totalUnits > 0 ? (op.scrapQty / totalUnits) * 100 : 0
      const downtimeRatio = totalHours > 0 ? (pauseHours / totalHours) * 100 : 0

      // Best machine
      const topMachineEntry = Object.entries(op.machinesMap).sort((a, b) => b[1] - a[1])[0]
      const topMachine = topMachineEntry ? topMachineEntry[0] : '—'

      // Best product
      const topNomEntry = Object.entries(op.nomMap).sort((a, b) => b[1] - a[1])[0]
      const topNom = topNomEntry ? topNomEntry[0] : '—'

      // Top pause reason
      const topPauseEntry = Object.entries(op.pauseReasons).sort((a, b) => b[1] - a[1])[0]
      const topPauseReason = topPauseEntry ? topPauseEntry[0] : '—'

      return {
        ...op,
        cardsCount: op.cardsSet.size,
        activeHours: Math.round(activeHours * 10) / 10,
        pauseHours: Math.round(pauseHours * 10) / 10,
        totalHours: Math.round(totalHours * 10) / 10,
        unitsPerHour,
        scrapRate: Math.round(scrapRate * 10) / 10,
        downtimeRatio: Math.round(downtimeRatio * 10) / 10,
        topMachine,
        topNom,
        topPauseReason
      }
    })

    // Filter by department if needed
    let filtered = list
    if (selectedDept !== 'ALL') {
      filtered = filtered.filter(op => op.department === selectedDept)
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(op => op.name.toLowerCase().includes(q) || op.position.toLowerCase().includes(q))
    }

    // Calculate median unitsPerHour for benchmark
    const speeds = filtered.map(o => o.unitsPerHour).filter(s => s > 0).sort((a, b) => a - b)
    const medianSpeed = speeds.length > 0 ? speeds[Math.floor(speeds.length / 2)] : 50

    // Assign Executive Tier & Composite Score
    return filtered.map(op => {
      // Speed index: 1.0 = median
      const speedIndex = medianSpeed > 0 ? op.unitsPerHour / medianSpeed : 1.0
      // Quality factor: 1.0 if 0% scrap, drops as scrap rises
      const qualityFactor = Math.max(0.2, 1 - (op.scrapRate / 10))
      // Uptime factor: 1.0 if low downtime
      const uptimeFactor = Math.max(0.5, 1 - (op.downtimeRatio / 100))

      const compositeScore = Math.min(100, Math.round((speedIndex * 50 + qualityFactor * 35 + uptimeFactor * 15)))

      let tier = 'A'
      let tierLabel = 'Стабільний (A)'
      let tierColor = '#10b981'
      let tierBadge = '🟢'

      if (compositeScore >= 88 && op.scrapRate <= 2.0) {
        tier = 'S'
        tierLabel = 'ТОП-Лідер (S)'
        tierColor = '#f59e0b'
        tierBadge = '⭐'
      } else if (compositeScore >= 70) {
        tier = 'A'
        tierLabel = 'Надійний (A)'
        tierColor = '#10b981'
        tierBadge = '🟢'
      } else if (compositeScore >= 50) {
        tier = 'B'
        tierLabel = 'Потребує уваги (B)'
        tierColor = '#3b82f6'
        tierBadge = '🟡'
      } else {
        tier = 'C'
        tierLabel = 'Критичний ризик (C)'
        tierColor = '#ef4444'
        tierBadge = '🔴'
      }

      return {
        ...op,
        compositeScore,
        tier,
        tierLabel,
        tierColor,
        tierBadge
      }
    }).sort((a, b) => b.compositeScore - a.compositeScore)
  }, [filteredHistory, userMap, nomMap, selectedDept, searchQuery])

  // 5. Shift Benchmarks (Зміна 1 vs Зміна 2 vs Зміна 3)
  const shiftStats = useMemo(() => {
    const shiftsMap = {
      'Зміна 1': { name: 'Зміна 1', produced: 0, scrap: 0, activeSec: 0, pauseSec: 0, operators: new Set() },
      'Зміна 2': { name: 'Зміна 2', produced: 0, scrap: 0, activeSec: 0, pauseSec: 0, operators: new Set() },
      'Зміна 3': { name: 'Зміна 3', produced: 0, scrap: 0, activeSec: 0, pauseSec: 0, operators: new Set() }
    }

    filteredHistory.forEach(h => {
      const sh = String(h.shift_name || '').trim()
      let target = null
      if (sh.includes('1')) target = shiftsMap['Зміна 1']
      else if (sh.includes('2')) target = shiftsMap['Зміна 2']
      else if (sh.includes('3')) target = shiftsMap['Зміна 3']

      if (!target) return

      if (h.operator_name) target.operators.add(h.operator_name)

      const s = new Date(h.started_at).getTime()
      const e = new Date(h.completed_at || h.started_at).getTime()
      const durSec = (s && e && e > s) ? Math.floor((e - s) / 1000) : 0
      const isPause = String(h.stage_name || '').toLowerCase().includes('зупинка')

      if (isPause) {
        target.pauseSec += durSec
      } else {
        target.activeSec += durSec
        target.produced += Number(h.qty_completed) || 0
        target.scrap += Number(h.scrap_qty) || 0
      }
    })

    return Object.values(shiftsMap).map(sh => {
      const totalUnits = sh.produced + sh.scrap
      const scrapRate = totalUnits > 0 ? (sh.scrap / totalUnits) * 100 : 0
      const activeHours = sh.activeSec / 3600
      const speed = activeHours > 0 ? Math.round(sh.produced / activeHours) : 0
      return {
        ...sh,
        operatorCount: sh.operators.size,
        scrapRate: Math.round(scrapRate * 10) / 10,
        speed,
        activeHours: Math.round(activeHours * 10) / 10
      }
    })
  }, [filteredHistory])

  // 6. AI Strategic Insights
  const aiInsights = useMemo(() => {
    if (operatorsStats.length === 0) return []
    const insights = []

    // 1. Top star
    const topPerformer = operatorsStats[0]
    if (topPerformer) {
      insights.push({
        type: 'leader',
        badge: '🌟 Лідер випуску',
        title: `${topPerformer.name} — Найвища ефективність (${topPerformer.compositeScore}/100)`,
        desc: `Виготовив ${topPerformer.producedQty.toLocaleString()} шт зі швидкістю ${topPerformer.unitsPerHour} шт/год та браком лише ${topPerformer.scrapRate}%. Рекомендовано преміювання.`,
        actionLabel: 'Відкрити досьє',
        operatorName: topPerformer.name
      })
    }

    // 2. Scrap alert
    const highScrapOp = [...operatorsStats].sort((a, b) => b.scrapRate - a.scrapRate)[0]
    if (highScrapOp && highScrapOp.scrapRate > 3.0 && highScrapOp.scrapQty > 10) {
      insights.push({
        type: 'warning',
        badge: '⚠️ Зона втрат браку',
        title: `Підвищений відсоток браку у ${highScrapOp.name} (${highScrapOp.scrapRate}%)`,
        desc: `Зафіксовано ${highScrapOp.scrapQty} бракованих деталей. Основна частина на виробі "${highScrapOp.topNom}". Рекомендовано перевірити якість налаштування інструменту.`,
        actionLabel: 'Аналіз браку',
        operatorName: highScrapOp.name
      })
    }

    // 3. Shift winner
    const bestShift = [...shiftStats].sort((a, b) => b.produced - a.produced)[0]
    if (bestShift && bestShift.produced > 0) {
      insights.push({
        type: 'shift',
        badge: '🏆 Лідер серед змін',
        title: `${bestShift.name} веде за обсягом випуску (${bestShift.produced.toLocaleString()} шт)`,
        desc: `Середня швидкість зміни: ${bestShift.speed} шт/год при показнику браку ${bestShift.scrapRate}%.`,
        shiftName: bestShift.name
      })
    }

    // 4. Tool/Cutter Champion
    const toolOps = operatorsStats.filter(o => o.cuttersUsed > 0 && o.producedQty > 500)
    if (toolOps.length > 0) {
      const bestToolOp = toolOps.sort((a, b) => (b.producedQty / b.cuttersUsed) - (a.producedQty / a.cuttersUsed))[0]
      const ratio = Math.round(bestToolOp.producedQty / bestToolOp.cuttersUsed)
      insights.push({
        type: 'tool',
        badge: '🔧 Еталон ресурсу фрез',
        title: `${bestToolOp.name} — максимальний ресурс інструменту`,
        desc: `Видає в середньому ${ratio} деталей на 1 фрезу. Зразок акуратного різання для інших операторів цеху.`
      })
    }

    return insights
  }, [operatorsStats, shiftStats])

  return {
    operatorsStats,
    shiftStats,
    aiInsights,
    totalRecords: filteredHistory.length
  }
}

