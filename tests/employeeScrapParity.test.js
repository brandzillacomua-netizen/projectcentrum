import { describe, expect, it } from 'vitest'
import {
  buildClassificationOnlyEvents,
  isConfirmedResponsibleClassification,
  matchesOperator,
  isShop1CuttingOperation,
  isShop2HistoryRecord
} from '../src/modules/reports/hooks/useEmployeeReport.js'

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

  it('attributes a new confirmed classification separately even when source history is loaded', () => {
    const classification = {
      id: 'classification-confirmed',
      source_history_id: 'history-in-range',
      source_operator_name: 'Петренко Іван',
      notes: '[VKYA_RESPONSIBLE_OPERATOR_CONFIRMED]',
      quantity: 4,
      scrap_classification_categories: [{ category: 4, quantity: 4 }]
    }
    const events = buildClassificationOnlyEvents({
      historyRows: [{ id: 'history-in-range', shift_name: 'Зміна 1', completed_at: '2026-10-20T08:00:00Z' }],
      filterByDate: inRange,
      classifications: [classification]
    })

    expect(isConfirmedResponsibleClassification(classification)).toBe(true)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ total: 4, cat4: 4 })
  })

  it('keeps a confirmed classification inside its source shift', () => {
    const base = {
      id: 'classification-confirmed-shift',
      source_history_id: 'history-shift',
      source_operator_name: 'Коваль Андрій',
      notes: '[VKYA_RESPONSIBLE_OPERATOR_CONFIRMED]',
      quantity: 2
    }
    const historyRows = [{ id: 'history-shift', shift_name: 'Зміна 2', completed_at: '2026-10-20T08:00:00Z' }]

    expect(buildClassificationOnlyEvents({ classifications: [base], historyRows, filterByDate: inRange, selectedShiftFilter: 'Зміна 1' })).toEqual([])
    expect(buildClassificationOnlyEvents({ classifications: [base], historyRows, filterByDate: inRange, selectedShiftFilter: 'Зміна 2' })).toHaveLength(1)
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

describe('isShop1CuttingOperation', () => {
  it('correctly identifies actual cutting operations with positive completed quantity', () => {
    expect(isShop1CuttingOperation('Розкрій', 200)).toBe(true)
    expect(isShop1CuttingOperation('розкрій', '150')).toBe(true)
    expect(isShop1CuttingOperation('Розкрій чпк', 50)).toBe(true)
  })

  it('rejects shift changes, stops, pauses, buffers, and non-cutting stages', () => {
    expect(isShop1CuttingOperation('Розкрій (перезмінка)', 200)).toBe(false)
    expect(isShop1CuttingOperation('Розкрій (зупинка)', 200)).toBe(false)
    expect(isShop1CuttingOperation('Буфер розкрою', 200)).toBe(false)
    expect(isShop1CuttingOperation('Розкрій', 0)).toBe(false)
    expect(isShop1CuttingOperation('Галтовка', 200)).toBe(false)
    expect(isShop1CuttingOperation('Прийомка', 200)).toBe(false)
    expect(isShop1CuttingOperation('Сортування', 200)).toBe(false)
    expect(isShop1CuttingOperation(null, 100)).toBe(false)
  })
})

describe('isShop2HistoryRecord', () => {
  it('identifies shop 2 manufacturing stages', () => {
    expect(isShop2HistoryRecord({ stage_name: 'Пресування' })).toBe(true)
    expect(isShop2HistoryRecord({ stage_name: 'Фарбування' })).toBe(true)
    expect(isShop2HistoryRecord({ stage_name: 'Доопрацювання' })).toBe(true)
    expect(isShop2HistoryRecord({ stage_name: 'Пакування' })).toBe(true)
    expect(isShop2HistoryRecord({ stage_name: 'Склад СГП (пряма передача)' })).toBe(true)
  })

  it('identifies shop 2 by card_info tag or operator department', () => {
    expect(isShop2HistoryRecord({ stage_name: 'Операція', card_info: '[ЦЕХ №2] Автоматично' })).toBe(true)
    expect(isShop2HistoryRecord({ stage_name: 'Операція' }, { department: 'Цех №2' })).toBe(true)
  })

  it('rejects Shop 1 stages and warehouse buffer without shop 2 tag', () => {
    expect(isShop2HistoryRecord({ stage_name: 'Розкрій' })).toBe(false)
    expect(isShop2HistoryRecord({ stage_name: 'Галтовка' })).toBe(false)
    expect(isShop2HistoryRecord({ stage_name: 'Прийомка' })).toBe(false)
    expect(isShop2HistoryRecord({ stage_name: 'Сортування' })).toBe(false)
    expect(isShop2HistoryRecord({ stage_name: 'Склад БЗ' })).toBe(false)
  })
})

describe('useEmployeeReport productionSummary calculation', () => {
  it('correctly aggregates Shop 1 cutting, Shop 2 unique cards, and operational volume', async () => {
    const { renderToString } = await import('react-dom/server')
    const React = await import('react')
    const { useEmployeeReport } = await import('../src/modules/reports/hooks/useEmployeeReport.js')

    let capturedResult = null

    function TestComponent() {
      capturedResult = useEmployeeReport({
        systemUsers: [
          { login: 'op1', first_name: 'Іван', last_name: 'Петренко', department: 'Цех №1' },
          { login: 'op2', first_name: 'Олег', last_name: 'Копитко', department: 'Цех №1' },
          { login: 'op3', first_name: 'Тарас', last_name: 'Шевченко', department: 'Цех №2' }
        ],
        workCardHistory: [
          // Card 1 in Shop 1:
          // 1. Розкрій (200 pcs)
          { id: 'h1', card_id: 'card-1', stage_name: 'Розкрій', operator_name: 'Петренко Іван', qty_completed: 200, scrap_qty: 0, completed_at: '2026-10-22T08:00:00Z' },
          // 2. Галтовка (200 pcs) - subsequent operation, should NOT add new physical parts to Shop 1
          { id: 'h2', card_id: 'card-1', stage_name: 'Галтовка', operator_name: 'Копитко Олег', qty_completed: 200, scrap_qty: 0, completed_at: '2026-10-22T09:00:00Z' },
          // 3. Прийомка (200 pcs)
          { id: 'h3', card_id: 'card-1', stage_name: 'Прийомка', operator_name: 'Петренко Іван', qty_completed: 200, scrap_qty: 0, completed_at: '2026-10-22T10:00:00Z' },
          
          // Card 2 in Shop 2:
          // 1. Пресування (300 pcs)
          { id: 'h4', card_id: 'card-2', stage_name: 'Пресування', operator_name: 'Шевченко Тарас', qty_completed: 300, scrap_qty: 0, completed_at: '2026-10-22T08:30:00Z' },
          // 2. Фарбування (300 pcs) - second operation on same card in Shop 2, should NOT double-count
          { id: 'h5', card_id: 'card-2', stage_name: 'Фарбування', operator_name: 'Шевченко Тарас', qty_completed: 300, scrap_qty: 0, completed_at: '2026-10-22T09:30:00Z' }
        ],
        scrapClassificationsList: [],
        scrapReasonsDb: [],
        nomenclatures: [],
        tasks: [],
        orders: [],
        workCards: [],
        filterByDate: () => true,
        selectedShiftFilter: 'all',
        selectedEmployeeFilter: 'all',
        searchQuery: ''
      })
      return React.createElement('div', null, 'OK')
    }

    renderToString(React.createElement(TestComponent))

    expect(capturedResult).not.toBeNull()
    const { productionSummary } = capturedResult

    // Shop 1 Cutting: only the 200 pcs cut on card-1
    expect(productionSummary.shop1Produced).toBe(200)
    expect(productionSummary.shop1Cards).toBe(1)

    // Shop 2 Unique Cards: 300 pcs on card-2 (not 600)
    expect(productionSummary.shop2Produced).toBe(300)
    expect(productionSummary.shop2Cards).toBe(1)

    // Operational output: sum of all operator actions (200 + 200 + 200 + 300 + 300 = 1200)
    expect(productionSummary.operationalProduced).toBe(1200)
    expect(productionSummary.totalOperations).toBe(5)
  })
})



