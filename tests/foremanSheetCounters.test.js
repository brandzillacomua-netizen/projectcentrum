import { describe, expect, it } from 'vitest'
import {
  calculateGeneratedSheetTotal,
  calculatePartShortage
} from '../src/modules/Foreman2/features/shortage/shortageCalculations.js'
import { calculateRemainingGenerationSheets } from '../src/modules/Foreman2/features/card-generation/cardGenerationCalculations.js'

const createSixSheetCards = () => Array.from({ length: 30 }, (_, index) => ({
  id: `card-${index + 1}`,
  task_id: 'task-1',
  nomenclature_id: 'nom-1',
  operation: 'Розкрій',
  quantity: 84,
  actual_sheets: 6,
  card_info: `№${index + 1}/30 [NEED:10000] [REQ:84] [BZ:0]`
}))

describe('Foreman sheet counters', () => {
  it('shows the sum of sheets actually assigned to cards, not the full plan', () => {
    const cards = createSixSheetCards()

    expect(calculateGeneratedSheetTotal(cards, 14, 715)).toBe(180)

    const result = calculatePartShortage({
      task: { id: 'task-1' },
      entry: {
        nomId: 'nom-1',
        name: 'ІП-77-Marun-V2-B-2-14',
        nom: { id: 'nom-1', units_per_sheet: 14 },
        snapshot: {
          need: 10000,
          stock: 0,
          plan: 10000,
          sheets: 715,
          units_per_sheet: 14,
          machine: 'CNC 12x8'
        }
      },
      cards,
      cardScrapMap: {},
      scrapByNom: {},
      flowTotalsByTaskNom: {}
    })

    expect(result.actualSheets).toBe(180)
    expect(result.plannedSheets).toBe(715)
  })

  it('uses neighbouring card data only for a legacy card with missing quantities', () => {
    const cards = createSixSheetCards()
    cards[0] = {
      ...cards[0],
      quantity: 0,
      actual_sheets: null,
      card_info: '№1/30'
    }

    expect(calculateGeneratedSheetTotal(cards, 14, 715)).toBe(180)
  })

  it('gives the counter and generator the same 558 of 572 result', () => {
    const cards = Array.from({ length: 140 }, (_, index) => ({
      id: `legacy-${index + 1}`,
      operation: 'Розкрій',
      quantity: index === 139 ? 28 : 56,
      card_info: `№${index + 1}/140 [SHEETS:${index === 139 ? 2 : 4}]`
    }))

    const generatedSheets = calculateGeneratedSheetTotal(cards, 14, 572)

    expect(generatedSheets).toBe(558)
    expect(calculateRemainingGenerationSheets({
      plannedSheets: 572,
      generatedSheets
    })).toBe(14)
  })
})
