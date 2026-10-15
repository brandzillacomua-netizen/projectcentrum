import test from 'node:test'
import assert from 'node:assert/strict'
import { calculatePartShortage, getCardSheets } from './shortageCalculations.js'

test('counts both required and BZ remainder cut from the same loading', () => {
  assert.equal(getCardSheets({
    operation: 'Розкрій',
    quantity: 104,
    card_info: '№37/37 [REQ:0] [BZ:104]'
  }, 26), 4)
})

test('reads the exact sheet count persisted in the card info tag', () => {
  assert.equal(getCardSheets({
    operation: 'Розкрій',
    quantity: 104,
    card_info: '№37/37 [SHEETS:4] [REQ:0] [BZ:104]'
  }, 26), 4)
})

test('VKYA return card consumes zero new sheets', () => {
  assert.equal(getCardSheets({
    operation: 'Буфер Цеху №2',
    quantity: 2,
    actual_sheets: 1,
    card_info: '[VKYA_RETURN] [SOURCE_CARD:card-1]'
  }, 26), 0)

  assert.equal(getCardSheets({
    operation: 'Буфер Цеху №2',
    quantity: 2,
    card_info: '[VKYA RETURN] [SOURCE CARD:card-1]'
  }, 26), 0)
})

test('warehouse cards consume zero new sheets', () => {
  assert.equal(getCardSheets({
    operation: 'Склад СГП',
    quantity: 26,
    actual_sheets: 1,
    card_info: '[ЗІ СКЛАДУ СГП] [BZ_RESERVATION:reservation-1]'
  }, 26), 0)
})

test('automatic Shop 2 cards consume zero new sheets', () => {
  assert.equal(getCardSheets({
    operation: 'Фарбування',
    quantity: 42,
    card_info: '[ЦЕХ №2] Автоматично [SHEETS:3] [SOURCE_CARD:cut-card]'
  }, 14), 0)
})

test('audit return tag appended to an original cutting card keeps its sheets', () => {
  assert.equal(getCardSheets({
    operation: 'Розкрій',
    quantity: 104,
    card_info: '№1/1 [REQ:104] [BZ:0] [VKYA_RETURN:history-1:2]'
  }, 26), 4)
})

test('part sheet total ignores VKYA returns and warehouse cards', () => {
  const result = calculatePartShortage({
    task: { id: 'task-1' },
    entry: {
      nomId: 'nom-1',
      name: 'Test detail',
      nom: { id: 'nom-1', units_per_sheet: 26 },
      snapshot: { need: 3500, stock: 26, plan: 3474, sheets: 134, units_per_sheet: 26 }
    },
    cards: [
      {
        id: 'cut-card', task_id: 'task-1', nomenclature_id: 'nom-1',
        operation: 'Розкрій', quantity: 3484, actual_sheets: 134,
        card_info: '№1/1 [REQ:3474] [BZ:10]'
      },
      {
        id: 'vkya-card', task_id: 'task-1', nomenclature_id: 'nom-1',
        operation: 'Буфер Цеху №2', quantity: 2, actual_sheets: 1,
        card_info: '[VKYA_RETURN] [SOURCE_CARD:cut-card]'
      },
      {
        id: 'stock-card', task_id: 'task-1', nomenclature_id: 'nom-1',
        operation: 'Склад СГП', quantity: 26, actual_sheets: 1,
        card_info: '[ЗІ СКЛАДУ СГП] [BZ_RESERVATION:reservation-1]'
      }
    ],
    cardScrapMap: {},
    scrapByNom: {},
    flowTotalsByTaskNom: {}
  })

  assert.equal(result.actualSheets, 134)
  assert.equal(result.productionCards.length, 2)
})

test('card with object-shaped cardScrapMap correctly restores sheet count', () => {
  const result = calculatePartShortage({
    task: { id: 'task-2' },
    entry: {
      nomId: 'nom-2',
      name: 'Detail 2',
      nom: { id: 'nom-2', units_per_sheet: 50 },
      snapshot: { need: 32000, stock: 0, plan: 32000, sheets: 640, units_per_sheet: 50, machine: 'Верстат 1200' }
    },
    cards: [
      {
        id: 'card-scrapped',
        task_id: 'task-2',
        nomenclature_id: 'nom-2',
        operation: 'Розкрій',
        quantity: 0,
        card_info: '№1/160 [REQ:200] [BZ:0]'
      }
    ],
    cardScrapMap: {
      'card-scrapped': { scrap: 200, util: 200 }
    },
    scrapByNom: {},
    flowTotalsByTaskNom: {}
  })

  assert.equal(result.actualSheets, 4)
})

test('actualSheets does not drop below plannedSheets once full card batch is created', () => {
  const cards = []
  // 160 cards planned for 640 sheets (4 sheets/card)
  for (let i = 1; i <= 160; i++) {
    // Suppose one card had its quantity wiped or tags altered
    cards.push({
      id: `card-${i}`,
      task_id: 'task-3',
      nomenclature_id: 'nom-3',
      operation: 'Розкрій',
      quantity: i === 1 ? 0 : 200,
      card_info: i === 1 ? '№1/160' : `№${i}/160 [SHEETS:4]`
    })
  }

  const result = calculatePartShortage({
    task: { id: 'task-3' },
    entry: {
      nomId: 'nom-3',
      name: 'Detail 3',
      nom: { id: 'nom-3', units_per_sheet: 50 },
      snapshot: { need: 32000, stock: 0, plan: 32000, sheets: 640, units_per_sheet: 50, machine: 'Верстат 1200' }
    },
    cards,
    cardScrapMap: {},
    scrapByNom: {},
    flowTotalsByTaskNom: {}
  })

  assert.equal(result.actualSheets, 640)
})

