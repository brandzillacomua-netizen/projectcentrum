import { describe, expect, it } from 'vitest'
import { buildClassificationOnlyEvents, matchesOperator } from '../src/modules/reports/hooks/useEmployeeReport.js'

describe('employee scrap classification parity', () => {
  const inRange = () => true

  it('keeps rework classification when its source history row is outside the loaded range', () => {
    const events = buildClassificationOnlyEvents({
      historyRows: [],
      filterByDate: inRange,
      classifications: [{
        id: 'classification-1',
        source_history_id: 'history-outside-range',
        quantity: 1,
        scrap_classification_categories: [{ category: 1, quantity: 1 }]
      }]
    })

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ total: 1, cat1: 1, cat2: 0, unclassified: 0 })
  })

  it('does not resurrect a classification whose source row is present but filtered elsewhere', () => {
    const events = buildClassificationOnlyEvents({
      historyRows: [{ id: 'history-in-range' }],
      filterByDate: inRange,
      classifications: [{
        id: 'classification-2',
        source_history_id: 'history-in-range',
        quantity: 1,
        scrap_classification_categories: [{ category: 2, quantity: 1 }]
      }]
    })

    expect(events).toEqual([])
  })

  it('does not assign shiftless classification records to a selected shift', () => {
    const events = buildClassificationOnlyEvents({
      historyRows: [],
      filterByDate: inRange,
      selectedShiftFilter: 'Зміна 1',
      classifications: [{ id: 'classification-3', quantity: 1 }]
    })

    expect(events).toEqual([])
  })
})

describe('matchesOperator multi-select', () => {
  it('returns true when filter is "all", null, or empty array', () => {
    expect(matchesOperator('Арендач С.', 'all')).toBe(true)
    expect(matchesOperator('Арендач С.', null)).toBe(true)
    expect(matchesOperator('Арендач С.', [])).toBe(true)
    expect(matchesOperator('Арендач С.', ['all'])).toBe(true)
  })

  it('matches single operator as string or inside an array', () => {
    expect(matchesOperator('Арендач С.', 'Арендач С.')).toBe(true)
    expect(matchesOperator('Арендач С.', ['Арендач С.'])).toBe(true)
    expect(matchesOperator('Арендач С.', ['Бабайлов О.', 'Арендач С.'])).toBe(true)
    expect(matchesOperator('Лука О.', ['Бабайлов О.', 'Арендач С.'])).toBe(false)
  })

  it('matches regardless of name token order', () => {
    expect(matchesOperator('Назар Когут', ['Когут Назар'])).toBe(true)
    expect(matchesOperator('Когут Назар', ['Когут Назар', 'Бабайлов О.'])).toBe(true)
  })
})

