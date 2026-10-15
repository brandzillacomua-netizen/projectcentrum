import { describe, expect, it } from 'vitest'
import {
  buildUniqueMachineCardHistory,
  getMachineStatusView,
  isFairyMachine,
  isCardAssignedToMachine
} from '../src/modules/Machines/utils/machineDashboardUtils.js'

describe('machine dossier view model', () => {
  it('shows one row per physical card instead of one row per history stage', () => {
    const rows = buildUniqueMachineCardHistory([
      { id: 'h1', card_id: 'card-1', created_at: '2026-10-15T10:00:00Z', qty_completed: 296, scrap_qty: 0 },
      { id: 'h2', card_id: 'card-1', created_at: '2026-10-15T10:10:00Z', qty_completed: 296, scrap_qty: 2 },
      { id: 'h3', card_id: 'card-2', created_at: '2026-10-15T10:20:00Z', qty_completed: 84, scrap_qty: 0 }
    ])

    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.card_id === 'card-1')).toMatchObject({ qty_completed: 296, scrap_qty: 2 })
  })

  it('keeps every unique operator in chronological order', () => {
    const [row] = buildUniqueMachineCardHistory([
      { id: 'h2', card_id: 'card-1', started_at: '2026-10-15T11:00:00Z', operator_name: 'Петро' },
      { id: 'h1', card_id: 'card-1', started_at: '2026-10-15T10:00:00Z', operator_name: 'Іван' },
      { id: 'h3', card_id: 'card-1', started_at: '2026-10-15T12:00:00Z', operator_name: 'Петро' }
    ])

    expect(row.operators).toEqual(['Іван', 'Петро'])
  })

  it('recognizes both Ukrainian and catalog names for the fairy machine', () => {
    expect(isFairyMachine({ name: 'ФЕЯ №1' })).toBe(true)
    expect(isFairyMachine({ type: 'CNC KE XIN - 4 - 16 листів' })).toBe(true)
    expect(isFairyMachine({ name: 'CNC 1200x800' })).toBe(false)
  })

  it('prioritizes maintenance status over active work', () => {
    expect(getMachineStatusView({ status: 'under_maintenance' }, true).key).toBe('maintenance')
    expect(getMachineStatusView({ status: 'idle' }, true).key).toBe('working')
  })

  it('matches a terminal machine label to the exact physical machine', () => {
    const machine = { id: 'm-10', name: 'CNC 12×8', type: 'CNC 1200x800 - 4 листи (Малий)', sequence_number: '1.10' }

    expect(isCardAssignedToMachine({ machine: 'CNC 12x8 №1.10' }, machine)).toBe(true)
    expect(isCardAssignedToMachine({ machine_name: 'CNC 12×8 №1.10' }, machine)).toBe(true)
    expect(isCardAssignedToMachine({ machine: 'CNC 12x8 №1.11' }, machine)).toBe(false)
    expect(isCardAssignedToMachine({ machine_id: 'm-11', machine: 'CNC 12x8 №1.10' }, machine)).toBe(false)
  })
})
