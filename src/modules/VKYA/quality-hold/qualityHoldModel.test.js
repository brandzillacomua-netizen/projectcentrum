import test from 'node:test'
import assert from 'node:assert/strict'
import { buildLegacyRecoverableInventoryItems, buildQualityLossIndex, buildQualityStatusTotals, buildRecoverableScrapLotItems, getFinalScrapForTaskPart } from './qualityHoldModel.js'
import { calculatePartShortage } from '../../Foreman2/features/shortage/shortageCalculations.js'

test('only confirmed final scrap is indexed as a production loss', () => {
  const index = buildQualityLossIndex([
    { task_id: 'task-1', card_id: 'card-1', nomenclature_id: 'nom-1', total_scrap: 3 },
    { task_id: 'task-1', card_id: 'card-2', nomenclature_id: 'nom-1', total_scrap: 2 }
  ])

  assert.equal(getFinalScrapForTaskPart(index, 'task-1', 'nom-1'), 5)
  assert.equal(getFinalScrapForTaskPart(index, 'task-1', 'nom-pending'), 0)
  assert.equal(index.byCard['card-1'], 3)
})

test('foreman shortage ignores a VKYA hold and uses category-4 loss only', () => {
  const common = {
    task: { id: 'task-1' },
    entry: {
      nomId: 'nom-1',
      name: 'Test detail',
      nom: { id: 'nom-1', units_per_sheet: 10 },
      snapshot: { need: 90, stock: 0, plan: 90, sheets: 10, units_per_sheet: 10 }
    },
    cards: [{ id: 'card-1', task_id: 'task-1', nomenclature_id: 'nom-1', quantity: 80, status: 'completed', operation: 'Розкрій' }],
    cardScrapMap: { 'card-1': 20 },
    scrapByNom: { 'nom-1': 20 },
    finalScrapByTask: { 'task-1': { 'nom-1': 5 } },
    flowTotalsByTaskNom: {}
  }

  const classified = calculatePartShortage({ ...common, hasFinalScrapProjection: true })
  assert.equal(classified.observedScrap, 20)
  assert.equal(classified.scrap, 5)
  assert.equal(classified.qualityHold, 15)
  assert.equal(classified.shortage, 0)

  const legacyFallback = calculatePartShortage({ ...common, hasFinalScrapProjection: false })
  assert.equal(legacyFallback.scrap, 20)
  assert.equal(legacyFallback.shortage, 10)
})

test('quarantine is the pending queue and former category 3 belongs to recoverable scrap', () => {
  const totals = buildQualityStatusTotals([
    { type: 'scrap_cat_1', total_qty: 4 },
    { type: 'scrap_cat_3', total_qty: 6 },
    { type: 'scrap_cat_4', total_qty: 2 }
  ], [
    { total_qty: 7 },
    { total_qty: 3 }
  ])

  assert.deepEqual(totals, {
    quarantine: 10,
    recoverableScrap: 10,
    finalScrap: 2,
    restoration: 0
  })
})

test('recoverable scrap keeps same nomenclature separated by source lot', () => {
  const rows = [
    { classification_category_id: 11, nomenclature_id: 'nom-1', order_number: 'N-1', available_quantity: 3, storage_type: 'scrap_cat_1' },
    { classification_category_id: 12, nomenclature_id: 'nom-1', order_number: 'N-2', available_quantity: 7, storage_type: 'scrap_cat_1' }
  ]
  const lots = buildRecoverableScrapLotItems(rows)
  assert.equal(lots.length, 2)
  assert.deepEqual(lots.map(item => [item.naryad_number, item.total_qty]), [['N-1', 3], ['N-2', 7]])
})

test('only inventory not represented by source lots is exposed as legacy aggregate', () => {
  const legacy = buildLegacyRecoverableInventoryItems([
    { id: 'inv-1', nomenclature_id: 'nom-1', type: 'scrap_cat_1', total_qty: 15 }
  ], [
    { nomenclature_id: 'nom-1', storage_type: 'scrap_cat_1', available_quantity: 10 }
  ])
  assert.equal(legacy.length, 1)
  assert.equal(legacy[0].total_qty, 5)
  assert.equal(legacy[0].inventory_id, 'inv-1')
})
