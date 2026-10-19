import { describe, expect, it } from 'vitest'
import {
  buildCuttingTimeSummary,
  getHistoryRowDurationSeconds,
  isCuttingStageRow,
  isCuttingStopRow,
  isCuttingWorkRow
} from '../src/modules/Foreman/utils/cuttingTimeReport.js'

describe('cutting time report', () => {
  const row = (stage_name, started_at, completed_at, extra = {}) => ({
    card_id: 'card-1',
    stage_name,
    started_at,
    completed_at,
    ...extra
  })

  it('includes every shift session but excludes stopped time from active work', () => {
    const rows = [
      row('Розкрій (перезмінка)', '2026-10-16T06:00:00Z', '2026-10-16T10:00:00Z'),
      row('Розкрій (перезмінка)', '2026-10-16T10:00:00Z', '2026-10-16T14:00:00Z'),
      row('Розкрій (зупинка)', '2026-10-16T14:00:00Z', '2026-10-16T15:00:00Z'),
      row('Розкрій', '2026-10-16T15:00:00Z', '2026-10-16T17:30:00Z')
    ]

    const summary = buildCuttingTimeSummary(rows)

    expect(summary.totalSeconds).toBe(10.5 * 60 * 60)
    expect(summary.sessionCount).toBe(3)
    expect(summary.handoverCount).toBe(2)
    expect(summary.cardCount).toBe(1)
    expect(summary.byCard['card-1'].totalSeconds).toBe(10.5 * 60 * 60)
  })

  it('does not double-count overlapping duplicate intervals', () => {
    const rows = [
      row('Розкрій (перезмінка)', '2026-10-16T06:00:00Z', '2026-10-16T10:00:00Z'),
      row('Розкрій (перезмінка)', '2026-10-16T06:00:00Z', '2026-10-16T10:00:00Z'),
      row('Розкрій', '2026-10-16T09:00:00Z', '2026-10-16T12:00:00Z')
    ]

    expect(buildCuttingTimeSummary(rows).totalSeconds).toBe(6 * 60 * 60)
  })

  it('recognizes cutting history rows and calculates one segment', () => {
    const work = row('Розкрій (перезмінка)', '2026-10-16T06:00:00Z', '2026-10-16T07:15:30Z')
    const stop = row('Розкрій (зупинка)', '2026-10-16T07:15:30Z', '2026-10-16T08:00:00Z')

    expect(isCuttingStageRow(work)).toBe(true)
    expect(isCuttingWorkRow(work)).toBe(true)
    expect(isCuttingStopRow(stop)).toBe(true)
    expect(isCuttingWorkRow(stop)).toBe(false)
    expect(getHistoryRowDurationSeconds(work)).toBe(4530)
  })
})
