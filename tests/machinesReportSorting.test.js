import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../src/supabase.js', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: async () => ({ data: [], error: null })
        })
      })
    })
  }
}))

import { compareMachinesBySequenceNumber } from '../src/modules/reports/hooks/useMachinesReport'

describe('Machines Report Dropdown & Sequence Number Sorting', () => {
  it('sorts alphanumeric machine sequence numbers from smallest ordinal number to largest', () => {
    const machines = [
      { id: 1, name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф8' },
      { id: 2, name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф12' },
      { id: 3, name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф13' },
      { id: 4, name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф9' },
      { id: 5, name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф2' },
      { id: 6, name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф7' },
      { id: 7, name: 'CNC KE XIN - ФЕЯ', sequence_number: 'Ф20' }
    ]

    const sorted = [...machines].sort(compareMachinesBySequenceNumber)
    expect(sorted.map(m => m.sequence_number)).toEqual([
      'Ф2',
      'Ф7',
      'Ф8',
      'Ф9',
      'Ф12',
      'Ф13',
      'Ф20'
    ])
  })

  it('handles mixed numeric/alphanumeric codes and places machines without sequence_number last', () => {
    const machines = [
      { id: 'a', name: 'Верстат Без Номера B', sequence_number: '' },
      { id: 'b', name: 'Верстат 10', sequence_number: '10' },
      { id: 'c', name: 'Верстат К3', sequence_number: 'К3' },
      { id: 'd', name: 'Верстат 1', sequence_number: '1' },
      { id: 'e', name: 'Верстат Без Номера A', sequence_number: null },
      { id: 'f', name: 'Верстат Ф2', sequence_number: 'Ф2' },
      { id: 'g', name: 'Верстат Текстовий', sequence_number: 'ABC' }
    ]

    const sorted = [...machines].sort(compareMachinesBySequenceNumber)
    expect(sorted.map(m => m.id)).toEqual(['d', 'f', 'c', 'b', 'g', 'e', 'a'])
  })

  it('applies compareMachinesBySequenceNumber to filteredMachines and name sorting', () => {
    const root = process.cwd()
    const hookSrc = fs.readFileSync(path.join(root, 'src/modules/reports/hooks/useMachinesReport.js'), 'utf8')
    const viewSrc = fs.readFileSync(path.join(root, 'src/modules/reports/components/MachinesReportView.jsx'), 'utf8')

    expect(hookSrc).toContain('.sort(compareMachinesBySequenceNumber)')
    expect(viewSrc).toContain('compareMachinesBySequenceNumber')
  })
})

