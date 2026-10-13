import { describe, expect, it } from 'vitest'
import {
  calculateRemainingGenerationSheets,
  findPartSnapshot,
  resolvePlannedSheetsForGeneration
} from '../src/modules/Foreman2/features/card-generation/cardGenerationCalculations.js'

describe('card generation sheet budget', () => {
  it('uses the calculated part sheet plan when the snapshot is stored under an old key', () => {
    const task = {
      plan_snapshot: {
        'old-part-key': { id: 'live-part-id', need: 600, plan: 600 }
      }
    }
    const part = {
      nomId: 'old-part-key',
      nom: { id: 'live-part-id' },
      plannedSheets: 6,
      plan: 600
    }

    const result = resolvePlannedSheetsForGeneration({
      task,
      part,
      nomenclatureId: 'live-part-id',
      unitsPerSheet: 100,
      requestedSheets: 6
    })

    expect(findPartSnapshot(task, part, 'live-part-id')).toEqual(task.plan_snapshot['old-part-key'])
    expect(result.plannedSheets).toBe(6)
  })

  it('falls back to the explicitly requested sheets for legacy snapshots without a plan', () => {
    const result = resolvePlannedSheetsForGeneration({
      task: { plan_snapshot: {} },
      part: {},
      nomenclatureId: 'part-id',
      unitsPerSheet: 50,
      requestedSheets: 4
    })

    expect(result.plannedSheets).toBe(4)
  })

  it('keeps duplicate protection by subtracting already generated sheets', () => {
    expect(calculateRemainingGenerationSheets({ plannedSheets: 6, generatedSheets: 4 })).toBe(2)
    expect(calculateRemainingGenerationSheets({ plannedSheets: 6, generatedSheets: 6 })).toBe(0)
    expect(calculateRemainingGenerationSheets({ plannedSheets: 6, generatedSheets: 8 })).toBe(0)
  })
})
