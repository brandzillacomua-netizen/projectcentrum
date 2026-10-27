import { describe, expect, it } from 'vitest'
import {
  buildCuttingTimeSummary,
  calculateCuttingPlanSeconds,
  consolidateCuttingRows,
  formatHandoverPendingInfo,
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

  it('calculates total cutting plan seconds across task cards using loadTimings', () => {
    const taskCards = [
      { id: 'c1', nomenclature_id: 'n1', operation: 'Розкрій', quantity: 184, card_info: '№1 [SHEETS:4]' },
      { id: 'c2', nomenclature_id: 'n1', operation: 'Розкрій', quantity: 92, card_info: '№2 [SHEETS:2]' },
      { id: 'c3', nomenclature_id: 'n1', operation: 'Галтовка', quantity: 184, card_info: '№1' }
    ]
    const noms = [{
      id: 'n1',
      units_per_sheet: 46,
      rule_params: {
        loadTimings: { '2': '45', '4': '60' }
      }
    }]

    // c1 (4 sheets) = 60m = 3600s, c2 (2 sheets) = 45m = 2700s, c3 is Galtovka (excluded)
    const planSec = calculateCuttingPlanSeconds(taskCards, noms)
    expect(planSec).toBe(3600 + 2700)

    // With cutting history scope, even if card has moved to downstream operation, plan is included
    const movedCards = [
      { id: 'c1', nomenclature_id: 'n1', operation: 'Сортування', quantity: 184, card_info: '№1 [SHEETS:4]' }
    ]
    const historyScope = new Set(['c1'])
    expect(calculateCuttingPlanSeconds(movedCards, noms, 'All', 'All', historyScope)).toBe(3600)
  })

  it('consolidates shift handover rows for the same card into a single entry', () => {
    const rawRows = [
      {
        id: 'r1',
        card_id: 'card-6',
        stage_name: 'Розкрій (перезмінка)',
        operator_name: 'Собенко Т',
        shift_name: 'Зміна 1',
        started_at: '2026-10-23T01:00:00Z',
        completed_at: '2026-10-23T08:00:00Z',
        qty_completed: 0
      },
      {
        id: 'r2',
        card_id: 'card-6',
        stage_name: 'Розкрій',
        operator_name: 'Шевчук А',
        shift_name: 'Зміна 4',
        started_at: '2026-10-23T08:00:00Z',
        completed_at: '2026-10-23T09:30:00Z',
        qty_completed: 184
      },
      {
        id: 'r3',
        card_id: 'card-7',
        stage_name: 'Розкрій',
        operator_name: 'Стефанишин Н',
        shift_name: 'Зміна 1',
        started_at: '2026-10-23T00:30:00Z',
        completed_at: '2026-10-23T04:30:00Z',
        qty_completed: 184
      }
    ]

    const consolidated = consolidateCuttingRows(rawRows)
    expect(consolidated).toHaveLength(2)
    const card6 = consolidated.find(r => r.card_id === 'card-6')
    expect(card6).toBeDefined()
    expect(card6.is_consolidated).toBe(true)
    expect(card6.session_count).toBe(2)
    expect(card6.duration_seconds).toBe(7 * 3600 + 1.5 * 3600) // 8.5 hours
    expect(card6.qty_completed).toBe(184)
    expect(card6.started_at).toBe('2026-10-23T01:00:00Z')
    expect(card6.completed_at).toBe('2026-10-23T09:30:00Z')
    expect(card6.sessions).toHaveLength(2)
  })

  it('formats handover pending information with short names and machine info', () => {
    const pendingRow = {
      card_id: 'card-103',
      stage_name: 'Розкрій (перезмінка)',
      operator_name: 'Станько А.',
      shift_name: 'Зміна 1',
      machine_name: 'CNC KE XIN - ФЕЯ №Ф16',
      card_info: 'Київ К-ІП9-10-П-7-46 [REPLACED_BY:Шевчук Андрій (Зміна 4)]',
      started_at: '2026-10-27T04:59:39Z',
      completed_at: '2026-10-27T08:35:56Z'
    }

    const info = formatHandoverPendingInfo(pendingRow, null, 12977)
    expect(info).toBeDefined()
    expect(info.nextOp).toBe('Шевчук А.')
    expect(info.machineShort).toBe('Ф16')
    expect(info.shiftInfo).toBe('(Зміна 1, 03:36)')
    expect(info.label).toBe('⏳ Шевчук А. (дорізає на Ф16)')
  })
})

