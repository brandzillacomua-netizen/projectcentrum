import test from 'node:test'
import assert from 'node:assert/strict'
import { buildQualityLossIndex, getFinalScrapForTaskPart } from './qualityHoldModel.js'
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

