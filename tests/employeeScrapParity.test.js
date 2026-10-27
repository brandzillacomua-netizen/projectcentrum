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

  it('attributes Galtovka operations by shift to the respective Galtovshchik user accounts instead of generic Команда галтовки', async () => {
    const { renderToString } = await import('react-dom/server')
    const React = await import('react')
    const { useEmployeeReport } = await import('../src/modules/reports/hooks/useEmployeeReport.js')

    let capturedResult = null

    function TestComponent() {
      capturedResult = useEmployeeReport({
        systemUsers: [
          { id: 101, login: 'galt.zm1', first_name: 'Зміна 1', last_name: 'Галтовка', position: 'Галтовщик', department: 'Цех №1', shift: 'Зміна 1' },
          { id: 102, login: 'galt.zm2', first_name: 'Зміна 2', last_name: 'Галтовка', position: 'Галтовщик', department: 'Цех №1', shift: 'Зміна 2' },
          { id: 103, login: 'galt.zm3', first_name: 'Зміна 1', last_name: 'Галтовка', position: 'Галтовщик', department: 'Цех №1', shift: 'Зміна 3' }
        ],
        workCardHistory: [
          // Shift 1 tumbling
          { id: 'h1', card_id: 'c1', stage_name: 'Галтовка (Галтовка)', operator_name: 'Команда галтовки', shift_name: 'Зміна 1', qty_completed: 100, scrap_qty: 0, completed_at: '2026-10-22T08:00:00Z' },
          // Shift 2 tumbling
          { id: 'h2', card_id: 'c2', stage_name: 'Галтовка (Мийка)', operator_name: 'Команда галтовки', shift_name: 'Зміна 2', qty_completed: 200, scrap_qty: 0, completed_at: '2026-10-22T10:00:00Z' },
          // Shift 3 tumbling
          { id: 'h3', card_id: 'c3', stage_name: 'Галтовка (Сушка)', operator_name: 'Команда галтовки', shift_name: 'Зміна 3', qty_completed: 300, scrap_qty: 5, completed_at: '2026-10-22T12:00:00Z' }
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
    const { employeeStats } = capturedResult

    // Should NOT have a combined "Команда галтовки" entry
    expect(employeeStats.some(e => e.name === 'Команда галтовки')).toBe(false)

    // Should have 3 separate shift Galtovshchik entries
    const zm1 = employeeStats.find(e => e.key === 'galt.zm1')
    expect(zm1).toBeDefined()
    expect(zm1.produced).toBe(100)
    expect(zm1.shift).toBe('Зміна 1')

    const zm2 = employeeStats.find(e => e.key === 'galt.zm2')
    expect(zm2).toBeDefined()
    expect(zm2.produced).toBe(200)
    expect(zm2.shift).toBe('Зміна 2')

    const zm3 = employeeStats.find(e => e.key === 'galt.zm3')
    expect(zm3).toBeDefined()
    expect(zm3.name).toBe('Галтовка Зміна 3')
    expect(zm3.produced).toBe(300)
    expect(zm3.scrap).toBe(5)
    expect(zm3.shift).toBe('Зміна 3')
  })

  it('attributes confirmed scrap strictly to the operator chosen by VKYA without duplicating to the second card operator', async () => {
    const { renderToString } = await import('react-dom/server')
    const React = await import('react')
    const { useEmployeeReport } = await import('../src/modules/reports/hooks/useEmployeeReport.js')

    let capturedResult = null

    function TestComponent() {
      capturedResult = useEmployeeReport({
        systemUsers: [
          { login: 'kravets.t', first_name: 'Тарас', last_name: 'Кравець', department: 'Цех №1' },
          { login: 'venhlinskyi.s', first_name: 'С.', last_name: 'Венглінський', department: 'Цех №1' }
        ],
        workCardHistory: [
          // Operator 1: Handover, 0 produced, 0 scrap
          { id: 'h-venh', card_id: 'card-100', stage_name: 'Розкрій (перезмінка)', operator_name: 'Венглінський С.', qty_completed: 0, scrap_qty: 0, completed_at: '2026-10-25T08:00:00Z' },
          // Operator 2: Finished cutting, 1816 pcs, defect entered: 296 scrap, legacy comment written on completion
          { id: 'h-krav', card_id: 'card-100', stage_name: 'Розкрій', operator_name: 'Кравець Тарас', qty_completed: 1816, scrap_qty: 296, qc_scrap_comment: '[SCRAP_CAT:{"cat4":296}]', completed_at: '2026-10-25T11:00:00Z' }
        ],
        scrapClassificationsList: [
          // VKYA explicitly chose Kravets Taras as responsible for this 296 pcs Category 4 scrap
          {
            id: 'class-296',
            source_history_id: 'h-krav',
            card_id: 'card-100',
            source_operator_name: 'Кравець Тарас',
            notes: '[VKYA_RESPONSIBLE_OPERATOR_CONFIRMED]',
            quantity: 296,
            scrap_classification_categories: [{ category: 4, quantity: 296 }],
            classified_at: '2026-10-25T12:00:00Z'
          }
        ],
        scrapReasonsDb: [],
        nomenclatures: [],
        tasks: [],
        orders: [],
        workCards: [{ id: 'card-100', operator_name: 'Кравець Тарас' }],
        filterByDate: () => true,
        selectedShiftFilter: 'all',
        selectedEmployeeFilter: 'all',
        searchQuery: ''
      })
      return React.createElement('div', null, 'OK')
    }

    renderToString(React.createElement(TestComponent))

    expect(capturedResult).not.toBeNull()
    const { employeeStats } = capturedResult

    const kravets = employeeStats.find(e => e.key === 'kravets.t')
    const venhlinskyi = employeeStats.find(e => e.key === 'venhlinskyi.s')

    expect(kravets).toBeDefined()
    expect(venhlinskyi).toBeDefined()

    // Kravets got the 296 scrap and 296 util exactly once (NOT 592)
    expect(kravets.produced).toBe(1816)
    expect(kravets.scrap).toBe(296)
    expect(kravets.util).toBe(296)

    // Venhlinskyi does NOT get the scrap or util
    expect(venhlinskyi.produced).toBe(0)
    expect(venhlinskyi.scrap).toBe(0)
    expect(venhlinskyi.util).toBe(0)
  })

  it('attributes confirmed scrap to Operator 1 when chosen by VKYA, clearing it from Operator 2', async () => {
    const { renderToString } = await import('react-dom/server')
    const React = await import('react')
    const { useEmployeeReport } = await import('../src/modules/reports/hooks/useEmployeeReport.js')

    let capturedResult = null

    function TestComponent() {
      capturedResult = useEmployeeReport({
        systemUsers: [
          { login: 'kravets.t', first_name: 'Тарас', last_name: 'Кравець', department: 'Цех №1' },
          { login: 'venhlinskyi.s', first_name: 'С.', last_name: 'Венглінський', department: 'Цех №1' }
        ],
        workCardHistory: [
          { id: 'h-venh', card_id: 'card-101', stage_name: 'Розкрій (перезмінка)', operator_name: 'Венглінський С.', qty_completed: 0, scrap_qty: 0, completed_at: '2026-10-25T08:00:00Z' },
          { id: 'h-krav', card_id: 'card-101', stage_name: 'Розкрій', operator_name: 'Кравець Тарас', qty_completed: 1816, scrap_qty: 296, qc_scrap_comment: '[SCRAP_CAT:{"cat4":296}]', completed_at: '2026-10-25T11:00:00Z' }
        ],
        scrapClassificationsList: [
          // VKYA explicitly chose Venhlinskyi as responsible
          {
            id: 'class-296-v',
            source_history_id: 'h-krav',
            card_id: 'card-101',
            source_operator_name: 'Венглінський С.',
            notes: '[VKYA_RESPONSIBLE_OPERATOR_CONFIRMED]',
            quantity: 296,
            scrap_classification_categories: [{ category: 4, quantity: 296 }],
            classified_at: '2026-10-25T12:00:00Z'
          }
        ],
        scrapReasonsDb: [],
        nomenclatures: [],
        tasks: [],
        orders: [],
        workCards: [{ id: 'card-101', operator_name: 'Кравець Тарас' }],
        filterByDate: () => true,
        selectedShiftFilter: 'all',
        selectedEmployeeFilter: 'all',
        searchQuery: ''
      })
      return React.createElement('div', null, 'OK')
    }

    renderToString(React.createElement(TestComponent))

    expect(capturedResult).not.toBeNull()
    const { employeeStats } = capturedResult

    const kravets = employeeStats.find(e => e.key === 'kravets.t')
    const venhlinskyi = employeeStats.find(e => e.key === 'venhlinskyi.s')

    expect(venhlinskyi.produced).toBe(0)
    expect(venhlinskyi.scrap).toBe(296)
    expect(venhlinskyi.util).toBe(296)

    expect(kravets.produced).toBe(1816)
    expect(kravets.scrap).toBe(0)
    expect(kravets.util).toBe(0)
  })

  it('does not penalize any operator or create a fake worker when scrap is attributed to software or technical causes', async () => {
    const { renderToString } = await import('react-dom/server')
    const React = await import('react')
    const { useEmployeeReport } = await import('../src/modules/reports/hooks/useEmployeeReport.js')

    let capturedResult = null

    function TestComponent() {
      capturedResult = useEmployeeReport({
        systemUsers: [
          { login: 'kravets.t', first_name: 'Тарас', last_name: 'Кравець', department: 'Цех №1' },
          { login: 'venhlinskyi.s', first_name: 'С.', last_name: 'Венглінський', department: 'Цех №1' }
        ],
        workCardHistory: [
          { id: 'h-101', card_id: 'card-102', stage_name: 'Розкрій', operator_name: 'Кравець Тарас', qty_completed: 500, scrap_qty: 40, qc_scrap_comment: '[SCRAP_CAT:{"cat4":40}]', completed_at: '2026-10-25T11:00:00Z' }
        ],
        scrapClassificationsList: [
          // VKYA attributed scrap to CNC program error
          {
            id: 'class-cnc-err',
            source_history_id: 'h-101',
            card_id: 'card-102',
            source_operator_name: 'Помилка програми / ЧПК',
            notes: '[VKYA_NON_HUMAN_SCRAP]',
            quantity: 40,
            scrap_classification_categories: [{ category: 4, quantity: 40 }],
            classified_at: '2026-10-25T12:00:00Z'
          }
        ],
        scrapReasonsDb: [],
        nomenclatures: [],
        tasks: [],
        orders: [],
        workCards: [{ id: 'card-102', operator_name: 'Кравець Тарас' }],
        filterByDate: () => true,
        selectedShiftFilter: 'all',
        selectedEmployeeFilter: 'all',
        searchQuery: ''
      })
      return React.createElement('div', null, 'OK')
    }

    renderToString(React.createElement(TestComponent))

    expect(capturedResult).not.toBeNull()
    const { employeeStats } = capturedResult

    // Worker produced 500 pcs, and his scrap remains 0 (not penalized by program error)
    const kravets = employeeStats.find(e => e.key === 'kravets.t')
    expect(kravets.produced).toBe(500)
    expect(kravets.scrap).toBe(0)
    expect(kravets.util).toBe(0)

    // Option 2: Special distinct non-human entry for "Помилка програми / ЧПК" is present
    const nonHuman = employeeStats.find(e => e.isNonHuman)
    expect(nonHuman).toBeDefined()
    expect(nonHuman.name).toContain('Помилка програми / ЧПК')
    expect(nonHuman.department).toBe('Без вини людей')
    expect(nonHuman.produced).toBe(0)
    expect(nonHuman.scrap).toBe(40)
    expect(nonHuman.util).toBe(40)
    expect(nonHuman.efficiency).toBeNull()
  })
})



