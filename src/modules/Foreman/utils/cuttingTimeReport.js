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

