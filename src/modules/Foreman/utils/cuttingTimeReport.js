import { getCardCuttingPlanSeconds, isCuttingCard, isCuttingOperation } from '../../../utils/cuttingTimeUtils.js'

const CUTTING_STAGE = 'Розкрій'
const SHIFT_HANDOVER_STAGE = 'Розкрій (перезмінка)'
const STOP_STAGE = 'Розкрій (зупинка)'

const asTimestamp = value => {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export const isCuttingStageRow = row => String(row?.stage_name || '').trim().startsWith(CUTTING_STAGE)

export const isCuttingWorkRow = row => {
  const stage = String(row?.stage_name || '').trim()
  return stage === CUTTING_STAGE || stage === SHIFT_HANDOVER_STAGE
}

export const isCuttingStopRow = row => String(row?.stage_name || '').trim() === STOP_STAGE

export const getHistoryRowDurationSeconds = row => {
  const startedAt = asTimestamp(row?.started_at)
  const completedAt = asTimestamp(row?.completed_at)
  if (startedAt === null || completedAt === null || completedAt <= startedAt) return 0
  return Math.round((completedAt - startedAt) / 1000)
}

const mergeIntervals = intervals => {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end)
  const merged = []
  sorted.forEach(interval => {
    const previous = merged.at(-1)
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval })
      return
    }
    previous.end = Math.max(previous.end, interval.end)
  })
  return merged
}

export function buildCuttingTimeSummary(rows = []) {
  const sessionsByCard = new Map()
  let handoverCount = 0

  rows.forEach(row => {
    if (!isCuttingWorkRow(row)) return
    const start = asTimestamp(row.started_at)
    const end = asTimestamp(row.completed_at)
    if (start === null || end === null || end <= start) return

    const cardId = String(row.card_id || 'unknown')
    if (!sessionsByCard.has(cardId)) sessionsByCard.set(cardId, [])
    sessionsByCard.get(cardId).push({ start, end, row })
    if (String(row.stage_name || '').trim() === SHIFT_HANDOVER_STAGE) handoverCount += 1
  })

  const byCard = {}
  let totalSeconds = 0
  let sessionCount = 0

  sessionsByCard.forEach((sessions, cardId) => {
    const merged = mergeIntervals(sessions)
    const cardTotalSeconds = merged.reduce((sum, interval) => sum + Math.round((interval.end - interval.start) / 1000), 0)
    const lastSession = [...sessions].sort((a, b) => b.end - a.end || b.start - a.start)[0]
    byCard[cardId] = {
      totalSeconds: cardTotalSeconds,
      sessionCount: sessions.length,
      mergedSessionCount: merged.length,
      firstStartedAt: Math.min(...sessions.map(session => session.start)),
      lastCompletedAt: Math.max(...sessions.map(session => session.end)),
      lastRow: lastSession?.row || null
    }
    totalSeconds += cardTotalSeconds
    sessionCount += sessions.length
  })

  return {
    totalSeconds,
    sessionCount,
    handoverCount,
    cardCount: Object.keys(byCard).length,
    byCard
  }
}

export function calculateCuttingPlanSeconds(taskCards = [], nomenclatures = [], filterNomId = 'All', filterCardLabel = 'All', cuttingHistoryCardIds = null) {
  const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))
  let totalPlanSeconds = 0
  const hasHistoryScope = Boolean(cuttingHistoryCardIds && cuttingHistoryCardIds.size > 0)

  taskCards.forEach(card => {
    if (!isCuttingCard(card)) return
    if (hasHistoryScope) {
      if (!cuttingHistoryCardIds.has(String(card.id))) return
    } else if (!isCuttingOperation(card.operation)) {
      return
    }
    if (filterNomId !== 'All' && String(card.nomenclature_id) !== String(filterNomId)) return
    if (filterCardLabel !== 'All') {
      const match = String(card.card_info || '').match(/(?:№|#)?\s*(\d+)\s*\/\s*(\d+)/)
      const seqStr = match ? `${match[1]}/${match[2]}` : (card.card_info || '')
      if (!seqStr.includes(filterCardLabel)) return
    }
    const nom = nomMap.get(String(card.nomenclature_id))
    totalPlanSeconds += getCardCuttingPlanSeconds(card, nom, hasHistoryScope)
  })

  return totalPlanSeconds
}

export function consolidateCuttingRows(rows = []) {
  const cuttingByCard = new Map()
  const result = []

  rows.forEach(row => {
    if (!isCuttingWorkRow(row)) {
      result.push(row)
      return
    }
    const cardId = String(row.card_id || row.id || 'unknown')
    if (!cuttingByCard.has(cardId)) {
      const entry = { sessions: [], placeholderIdx: result.length }
      cuttingByCard.set(cardId, entry)
      result.push(null)
    }
    cuttingByCard.get(cardId).sessions.push(row)
  })

  cuttingByCard.forEach(({ sessions, placeholderIdx }) => {
    if (sessions.length === 1) {
      result[placeholderIdx] = sessions[0]
      return
    }
    sessions.sort((a, b) => new Date(a.started_at || a.created_at || 0) - new Date(b.started_at || b.created_at || 0))
    const first = sessions[0]
    const last = sessions[sessions.length - 1]
    const totalDuration = sessions.reduce((sum, s) => sum + getHistoryRowDurationSeconds(s), 0)
    const totalQty = sessions.reduce((sum, s) => sum + (Number(s.qty_completed) || 0), 0)
    const totalScrap = sessions.reduce((sum, s) => sum + (Number(s.scrap_qty) || 0), 0)
    const totalCutters = sessions.reduce((sum, s) => sum + (Number(s.cutters_used) || 0), 0)

    result[placeholderIdx] = {
      ...last,
      id: `consolidated-${first.id}`,
      started_at: first.started_at,
      completed_at: last.completed_at,
      duration_seconds: totalDuration,
      qty_completed: totalQty,
      scrap_qty: totalScrap,
      cutters_used: totalCutters,
      stage_name: CUTTING_STAGE,
      is_consolidated: true,
      session_count: sessions.length,
      sessions: sessions.map(s => ({
        ...s,
        duration: getHistoryRowDurationSeconds(s)
      }))
    }
  })

  return result.filter(Boolean)
}

export function formatHandoverPendingInfo(row, card, durationSeconds) {
  const replacedMatch = String(row?.card_info || '').match(/\[REPLACED_BY:(.*?)\]/)
  if (!replacedMatch) return null

  const rawNext = replacedMatch[1].replace(/\s*\([^)]*\)/, '').trim()
  const parts = rawNext.split(/\s+/)
  const nextOp = parts.length >= 2 && parts[1].length > 1 && !parts[1].endsWith('.')
    ? `${parts[0]} ${parts[1][0]}.`
    : rawNext

  const machine = row?.machine_name || row?.machine || card?.machine || ''
  const machineShort = machine.match(/(?:№|#)?\s*(Ф\d+)/i)?.[1] || machine.replace(/CNC KE XIN - /i, '').trim()

  const dur = typeof durationSeconds === 'number' ? durationSeconds : getHistoryRowDurationSeconds(row)
  let timeStr = ''
  if (dur > 0) {
    const h = Math.floor(dur / 3600)
    const m = Math.floor((dur % 3600) / 60)
    timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }

  const shiftInfo = [row?.shift_name, timeStr].filter(Boolean).join(', ')

  return {
    nextOp,
    machineShort,
    shiftInfo: shiftInfo ? `(${shiftInfo})` : '',
    label: `⏳ ${nextOp} (дорізає${machineShort ? ` на ${machineShort}` : ''})`
  }
}


