import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getDraftKey,
  getOpsDraft,
  saveOpsDraft,
  clearOpsDraft
} from '../src/modules/Engineer/utils/operationsDraft.js'

describe('operationsDraft utility', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('generates consistent keys', () => {
    const key = getDraftKey('nom-123', 'CNC 1200x800 - 4 листи (Малий)')
    expect(key).toBe('centrum_ops_draft_nom-123_CNC_1200x800_-_4_листи_(Малий)')
  })

  it('returns null if arguments are missing', () => {
    expect(getDraftKey(null, 'CNC')).toBeNull()
    expect(getDraftKey('nom', null)).toBeNull()
    expect(getOpsDraft(null, null)).toBeNull()
  })

  it('saves, reads, and clears drafts properly', () => {
    const testData = {
      side1Ops: ['op1'],
      side2OpsF2: ['уп1.1 ф3 отвори'],
      side2OpsF15: ['фівфеі'],
      side2CutOpsF2: ['контур 1'],
      side2CutOpsF15: ['контур 1.5'],
      inlineCuttersList: [{ nomId: 'cutter-1', qty: 2 }]
    }

    saveOpsDraft('nom-abc', 'CNC_test', testData)

    const retrieved = getOpsDraft('nom-abc', 'CNC_test')
    expect(retrieved).not.toBeNull()
    expect(retrieved.side2OpsF15).toEqual(['фівфеі'])
    expect(retrieved.side2OpsF2).toEqual(['уп1.1 ф3 отвори'])
    expect(retrieved.updatedAt).toBeDefined()

    clearOpsDraft('nom-abc', 'CNC_test')
    expect(getOpsDraft('nom-abc', 'CNC_test')).toBeNull()
  })
})
