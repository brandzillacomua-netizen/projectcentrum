/**
 * Pure calculation helpers for Director Team Analytics & AI Insights
 */

export function filterHistoryByDate(workCardHistory = [], dateRange = '30d', now = new Date()) {
  if (!workCardHistory || workCardHistory.length === 0) return []
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
}

export function calculateOperatorTier(compositeScore, scrapRate) {
  if (compositeScore >= 88 && scrapRate <= 2.0) {
    return {
      tier: 'S',
      tierLabel: 'ТОП-Лідер (S)',
      tierColor: '#f59e0b',
      tierBadge: '⭐'
    }
  } else if (compositeScore >= 70) {
    return {
      tier: 'A',
      tierLabel: 'Надійний (A)',
      tierColor: '#10b981',
      tierBadge: '🟢'
    }
  } else if (compositeScore >= 50) {
    return {
      tier: 'B',
      tierLabel: 'Потребує уваги (B)',
      tierColor: '#3b82f6',
      tierBadge: '🟡'
    }
  } else {
    return {
      tier: 'C',
      tierLabel: 'Критичний ризик (C)',
      tierColor: '#ef4444',
      tierBadge: '🔴'
    }
  }
}

export function computeOperatorsStats({
  filteredHistory = [],
  systemUsers = [],
  nomenclatures = [],
  selectedDept = 'ALL',
  searchQuery = ''
}) {
  // 1. Build User Map
  const userMap = new Map()
  systemUsers.forEach(u => {
    const fullName = `${u.last_name || ''} ${u.first_name || ''}`.trim()
    if (fullName) userMap.set(fullName.toLowerCase(), u)
    if (u.login) userMap.set(u.login.toLowerCase(), u)
  })

  // 2. Build Nom Map
  const nomMap = new Map()
  nomenclatures.forEach(n => {
    if (n && n.id) nomMap.set(String(n.id), n)
  })

  // 3. Group by operator
  const map = new Map()

  filteredHistory.forEach(h => {
    const rawName = String(h.operator_name || '').trim()
    if (!rawName || rawName === 'Не вказано' || rawName === '-' || rawName.toLowerCase().includes('автомат')) {
      return
    }

    const normName = rawName
    if (!map.has(normName)) {
      const u = userMap.get(normName.toLowerCase()) || {}
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

    if (h.work_card_id || h.card_id) {
      rec.cardsSet.add(h.work_card_id || h.card_id)
    }

    // Produced qty
    const produced = Number(h.qty_completed || h.quantity_completed || h.produced_qty || 0)
    if (produced > 0 && (stage.includes('розкрій') || stage.includes('порізка') || stage.includes('цех') || !stage)) {
      rec.producedQty += produced
    } else if (produced > 0 && rec.producedQty === 0) {
      rec.producedQty += produced
    }

    // Scrap qty
    const scrap = Number(h.scrap_qty || h.quantity_scrap || h.defect_qty || 0)
    if (scrap > 0) rec.scrapQty += scrap

    // Cutters used
    const cutters = Number(h.cutters_used || h.cutters_consumed || 0)
    if (cutters > 0) rec.cuttersUsed += cutters

    // Active / Pause duration
    const activeS = Number(h.duration_active_sec || h.work_seconds || 0)
    const pauseS = Number(h.duration_pause_sec || h.pause_seconds || 0)

    if (activeS > 0) {
      rec.activeSec += activeS
    } else if (h.started_at && h.completed_at) {
      const span = (new Date(h.completed_at).getTime() - new Date(h.started_at).getTime()) / 1000
      if (span > 0 && span < 24 * 3600) {
        rec.activeSec += Math.max(0, span - pauseS)
      }
    }

    if (pauseS > 0) {
      rec.pauseSec += pauseS
      rec.pauseCount += 1
    }

    // Machine usage
    const mName = h.machine_name || h.equipment_name || 'Верстат'
    rec.machinesMap[mName] = (rec.machinesMap[mName] || 0) + 1

    // Product breakdown
    const nomObj = nomMap.get(String(h.nomenclature_id))
    const pName = h.product_name || nomObj?.name || h.part_name || 'Деталь'
    rec.nomMap[pName] = (rec.nomMap[pName] || 0) + (produced || 1)

    // Pause reasons
    if (h.pause_reason) {
      rec.pauseReasons[h.pause_reason] = (rec.pauseReasons[h.pause_reason] || 0) + 1
    }

    // Stages
    if (h.stage_name) {
      rec.stagesMap[h.stage_name] = (rec.stagesMap[h.stage_name] || 0) + 1
    }
  })

  // 4. Compute rates and aggregates
  const list = Array.from(map.values()).map(op => {
    const activeHours = op.activeSec / 3600
    const pauseHours = op.pauseSec / 3600
    const totalHours = activeHours + pauseHours

    const totalProcessed = op.producedQty + op.scrapQty
    const scrapRate = totalProcessed > 0 ? (op.scrapQty / totalProcessed) * 100 : 0
    const unitsPerHour = activeHours > 0.1 ? Math.round(op.producedQty / activeHours) : 0
    const downtimeRatio = totalHours > 0.1 ? (pauseHours / totalHours) * 100 : 0

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

  // Filter by department
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
    const speedIndex = medianSpeed > 0 ? op.unitsPerHour / medianSpeed : 1.0
    const qualityFactor = Math.max(0.2, 1 - (op.scrapRate / 10))
    const uptimeFactor = Math.max(0.5, 1 - (op.downtimeRatio / 100))

    const compositeScore = Math.min(100, Math.round((speedIndex * 50 + qualityFactor * 35 + uptimeFactor * 15)))
    const tierMeta = calculateOperatorTier(compositeScore, op.scrapRate)

    return {
      ...op,
      compositeScore,
      ...tierMeta
    }
  }).sort((a, b) => b.compositeScore - a.compositeScore)
}

export function computeShiftStats(operators = []) {
  const shiftsMap = {
    'Зміна 1': { name: 'Зміна 1', produced: 0, scrap: 0, activeSec: 0, cutters: 0, ops: new Set() },
    'Зміна 2': { name: 'Зміна 2', produced: 0, scrap: 0, activeSec: 0, cutters: 0, ops: new Set() },
    'Зміна 3': { name: 'Зміна 3', produced: 0, scrap: 0, activeSec: 0, cutters: 0, ops: new Set() },
    'Зміна 4': { name: 'Зміна 4', produced: 0, scrap: 0, activeSec: 0, cutters: 0, ops: new Set() }
  }

  operators.forEach(op => {
    let sKey = 'Зміна 1'
    if (op.shift?.includes('4')) sKey = 'Зміна 4'
    else if (op.shift?.includes('3')) sKey = 'Зміна 3'
    else if (op.shift?.includes('2')) sKey = 'Зміна 2'
    else if (op.shift?.includes('1')) sKey = 'Зміна 1'
    else if (op.shift && op.shift !== 'Без зміни') {
      sKey = op.shift
      if (!shiftsMap[sKey]) {
        shiftsMap[sKey] = { name: sKey, produced: 0, scrap: 0, activeSec: 0, cutters: 0, ops: new Set() }
      }
    }

    const target = shiftsMap[sKey] || shiftsMap['Зміна 1']
    target.produced += op.producedQty
    target.scrap += op.scrapQty
    target.activeSec += op.activeSec
    target.cutters += op.cuttersUsed
    target.ops.add(op.name)
  })

  return Object.values(shiftsMap).map(s => {
    const hours = Math.round((s.activeSec / 3600) * 10) / 10
    const speed = hours > 0.1 ? Math.round(s.produced / (s.activeSec / 3600)) : 0
    const total = s.produced + s.scrap
    const scrapRate = total > 0 ? Math.round((s.scrap / total) * 1000) / 10 : 0

    return {
      name: s.name,
      produced: s.produced,
      scrap: s.scrap,
      scrapRate,
      speed,
      cutters: s.cutters,
      activeHours: hours,
      operatorCount: s.ops.size,
      operatorsCount: s.ops.size
    }
  })
}

export function generateTeamAIInsights(operators = [], shiftStats = []) {
  const insights = []
  if (operators.length === 0) return insights

  // 1. Absolute Speed Champion
  const sortedBySpeed = [...operators].sort((a, b) => b.unitsPerHour - a.unitsPerHour)
  if (sortedBySpeed[0] && sortedBySpeed[0].unitsPerHour > 0) {
    const leader = sortedBySpeed[0]
    insights.push({
      type: 'speed',
      badge: '🚀 Флагман швидкості',
      title: `${leader.name} демонструє найвищу продуктивність (${leader.unitsPerHour} шт/год)`,
      desc: `Вироблено ${leader.producedQty.toLocaleString()} деталей із показником браку всього ${leader.scrapRate}%. Рекомендовано масштабувати його робочий сетап на зміну.`,
      actionLabel: 'Відкрити досьє',
      operatorName: leader.name
    })
  }

  // 2. High Scrap Risk Alert
  const highScrapOp = [...operators].sort((a, b) => b.scrapRate - a.scrapRate)[0]
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
  const toolOps = operators.filter(o => o.cuttersUsed > 0 && o.producedQty > 500)
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
}

