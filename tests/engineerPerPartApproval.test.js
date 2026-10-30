import { describe, it, expect, vi } from 'vitest'
import {
  getTaskParts,
  isTaskFullyEngineerApproved,
  isPartEngineerApproved,
  resolveEngineerTaskSelection
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

  describe('resolveEngineerTaskSelection', () => {
    const parts = [
      { nomId: 'nom-1', name: 'Деталь 1' },
      { nomId: 'nom-2', name: 'Деталь 2' },
      { nomId: 'nom-3', name: 'Деталь 3' },
      { nomId: 'nom-4', name: 'Деталь 4' }
    ]

    it('defaults to selecting all parts for a fresh task with 0 approvals', () => {
      const res = resolveEngineerTaskSelection(mockTask, parts, undefined)
      expect(res.approvedNoms).toEqual([])
      expect(res.unapprovedPartIds).toEqual(['nom-1', 'nom-2', 'nom-3', 'nom-4'])
      expect(res.selectedUnapproved).toEqual(['nom-1', 'nom-2', 'nom-3', 'nom-4'])
      expect(res.effectiveSelectedIds).toEqual(['nom-1', 'nom-2', 'nom-3', 'nom-4'])
      expect(res.isPartiallyApproved).toBe(false)
      expect(res.newlySelectedCount).toBe(4)
      expect(res.totalSelectedCount).toBe(4)
    })

    it('defaults to 0 newly selected unapproved parts for a partially approved task', () => {
      const partialTask = {
        ...mockTask,
        engineer_conf: true,
        plan_snapshot: {
          ...mockTask.plan_snapshot,
          _engineer_approved_noms: ['nom-3', 'nom-4']
        }
      }

      const res = resolveEngineerTaskSelection(partialTask, parts, undefined)
      expect(res.approvedNoms).toEqual(['nom-3', 'nom-4'])
      expect(res.unapprovedPartIds).toEqual(['nom-1', 'nom-2'])
      expect(res.selectedUnapproved).toEqual([])
      // effectiveSelectedIds still includes already approved parts
      expect(res.effectiveSelectedIds).toEqual(['nom-3', 'nom-4'])
      expect(res.isPartiallyApproved).toBe(true)
      expect(res.newlySelectedCount).toBe(0)
      expect(res.totalSelectedCount).toBe(2)
    })

    it('allows selecting an additional part while strictly protecting already approved parts', () => {
      const partialTask = {
        ...mockTask,
        engineer_conf: true,
        plan_snapshot: {
          ...mockTask.plan_snapshot,
          _engineer_approved_noms: ['nom-3', 'nom-4']
        }
      }

      // User selects nom-1 as the 3rd part
      const res = resolveEngineerTaskSelection(partialTask, parts, ['nom-1'])
      expect(res.approvedNoms).toEqual(['nom-3', 'nom-4'])
      expect(res.selectedUnapproved).toEqual(['nom-1'])
      expect(res.effectiveSelectedIds).toEqual(['nom-3', 'nom-4', 'nom-1'])
      expect(res.newlySelectedCount).toBe(1)
      expect(res.totalSelectedCount).toBe(3)
    })

    it('ignores any attempt in userSelection to deselect already approved parts', () => {
      const partialTask = {
        ...mockTask,
        engineer_conf: true,
        plan_snapshot: {
          ...mockTask.plan_snapshot,
          _engineer_approved_noms: ['nom-3', 'nom-4']
        }
      }

      // Even if userSelection explicitly omits nom-3, nom-4 or passes weird IDs
      const res = resolveEngineerTaskSelection(partialTask, parts, ['nom-1'])
      expect(res.effectiveSelectedIds.includes('nom-3')).toBe(true)
      expect(res.effectiveSelectedIds.includes('nom-4')).toBe(true)
      expect(res.effectiveSelectedIds.includes('nom-1')).toBe(true)
    })

    it('correctly reports full completion when remaining unapproved parts are all selected', () => {
      const partialTask = {
        ...mockTask,
        engineer_conf: true,
        plan_snapshot: {
          ...mockTask.plan_snapshot,
          _engineer_approved_noms: ['nom-3', 'nom-4']
        }
      }

      const res = resolveEngineerTaskSelection(partialTask, parts, ['nom-1', 'nom-2'])
      expect(res.effectiveSelectedIds.length).toBe(4)
      expect(res.totalSelectedCount).toBe(4)
    })
  })
})

