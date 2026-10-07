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
