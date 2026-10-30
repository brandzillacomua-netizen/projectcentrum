import { describe, it, expect, vi } from 'vitest'
import {
  getTaskParts,
  isTaskFullyEngineerApproved,
  isPartEngineerApproved
} from '../src/modules/Engineer/utils/engineerHelpers.jsx'

describe('Engineer per-part approval logic', () => {
  const mockNomenclatures = [
    { id: 'nom-1', name: 'Деталь 1', code: 'D1', cnc_program: 'UP_01.nc', material_type: 'T700' },
    { id: 'nom-2', name: 'Деталь 2', code: 'D2', cnc_program: 'UP_02.nc', material_type: 'T700' },
    { id: 'nom-3', name: 'Деталь 3', code: 'D3', cnc_program: null, material_type: 'T700' }
  ]

  const mockTask = {
    id: 'task-100',
    order_id: 'order-10',
    engineer_conf: false,
    plan_snapshot: {
      'nom-1': { need: 10, sheets: 2 },
      'nom-2': { need: 20, sheets: 4 },
      'nom-3': { need: 30, sheets: 6 }
    }
  }

  it('correctly extracts task parts from plan_snapshot', () => {
    const parts = getTaskParts(mockTask, null, mockNomenclatures)
    expect(parts.length).toBe(3)
    expect(parts[0].nomId).toBe('nom-1')
    expect(parts[0].cnc_program).toBe('UP_01.nc')
    expect(parts[2].cnc_program).toBe(null)
  })

  it('marks task as not fully approved when engineer_conf is false', () => {
    expect(isTaskFullyEngineerApproved(mockTask, [], mockNomenclatures)).toBe(false)
  })

  it('marks task as partially approved when only some parts are in _engineer_approved_noms', () => {
    const partialTask = {
      ...mockTask,
      engineer_conf: true,
      plan_snapshot: {
        ...mockTask.plan_snapshot,
        _engineer_approved_noms: ['nom-1', 'nom-2']
      }
    }
    // Partial: not all parts approved
    expect(isTaskFullyEngineerApproved(partialTask, [], mockNomenclatures)).toBe(false)

    // Check individual part approval
    expect(isPartEngineerApproved(partialTask, 'nom-1')).toBe(true)
    expect(isPartEngineerApproved(partialTask, 'nom-2')).toBe(true)
    expect(isPartEngineerApproved(partialTask, 'nom-3')).toBe(false)
  })

  it('marks task as fully approved when all parts are in _engineer_approved_noms', () => {
    const fullyApprovedTask = {
      ...mockTask,
      engineer_conf: true,
      plan_snapshot: {
        ...mockTask.plan_snapshot,
        _engineer_approved_noms: ['nom-1', 'nom-2', 'nom-3']
      }
    }
    expect(isTaskFullyEngineerApproved(fullyApprovedTask, [], mockNomenclatures)).toBe(true)
    expect(isPartEngineerApproved(fullyApprovedTask, 'nom-1')).toBe(true)
    expect(isPartEngineerApproved(fullyApprovedTask, 'nom-3')).toBe(true)
  })

  it('preserves backwards compatibility for legacy tasks without _engineer_approved_noms', () => {
    const legacyTask = {
      ...mockTask,
      engineer_conf: true,
      plan_snapshot: {
        ...mockTask.plan_snapshot
      }
    }
    // Legacy task with engineer_conf === true should treat all parts as approved
    expect(isTaskFullyEngineerApproved(legacyTask, [], mockNomenclatures)).toBe(true)
    expect(isPartEngineerApproved(legacyTask, 'nom-1')).toBe(true)
    expect(isPartEngineerApproved(legacyTask, 'nom-3')).toBe(true)
  })
})

