import { describe, expect, it } from 'vitest'
import { isMachineMatch } from '../src/utils/cutterCalculator.js'

describe('Foreman 2.0 card generation machine filtering by engineering operations', () => {
  const WORKSHOP_MACHINES = [
    { id: 'm1', name: 'CNC 12x8', sheet_capacity: 6 },
    { id: 'm2', name: 'CNC 3050', sheet_capacity: 12 },
    { id: 'm3', name: 'CNC 3060x1600', sheet_capacity: 36 },
    { id: 'm4', name: 'CNC KE XIN - ФЕЯ', sheet_capacity: 16 },
    { id: 'm5', name: 'Дракон', sheet_capacity: 96 }
  ]
  const MACHINE_TYPES = WORKSHOP_MACHINES.map(m => m.name)

  it('matches all engineering machine labels with foreman workshop machine types', () => {
    expect(isMachineMatch('Малий (1200)', 'CNC 12x8')).toBe(true)
    expect(isMachineMatch('Фея', 'CNC KE XIN - ФЕЯ')).toBe(true)
    expect(isMachineMatch('3050', 'CNC 3050')).toBe(true)
    expect(isMachineMatch('3-Головий', 'CNC 3060x1600')).toBe(true)
    expect(isMachineMatch('3-Головий (3060)', 'CNC 3060x1600')).toBe(true)
    expect(isMachineMatch('Дракон', 'Дракон')).toBe(true)
    expect(isMachineMatch('CNC 6000x2000 - 4 - 96 листів (Дракон)', 'Дракон')).toBe(true)
  })

  it('filters available machines to only those with configured operations for the part', () => {
    const partNomId = 'nom-plate-79'
    const machineOperations = [
      {
        id: 'op1',
        nomenclature_id: 'nom-plate-79',
        machine_type: 'Малий (1200)',
        side1_ops: ['Обробка 1'],
        side2_cut_ops: ['__CUTTER__:f2:1']
      },
      {
        id: 'op2',
        nomenclature_id: 'nom-plate-79',
        machine_type: 'Фея',
        side1_ops: ['Обробка Фея'],
        side2_cut_ops: []
      },
      {
        id: 'op3',
        nomenclature_id: 'other-part',
        machine_type: 'CNC 3050',
        side1_ops: ['3050 op']
      }
    ]

    const partMachineOps = machineOperations.filter(o => o.nomenclature_id === partNomId)
    const configuredMachineTypes = MACHINE_TYPES.filter(mName => {
      return partMachineOps.some(op => {
        if (op.machine_type && isMachineMatch(op.machine_type, mName)) return true
        if (op.machine_id && isMachineMatch(op.machine_id, mName)) return true
        return false
      })
    })

    expect(configuredMachineTypes).toEqual(['CNC 12x8', 'CNC KE XIN - ФЕЯ'])
    expect(configuredMachineTypes).not.toContain('CNC 3050')
    expect(configuredMachineTypes).not.toContain('CNC 3060x1600')
    expect(configuredMachineTypes).not.toContain('Дракон')
  })

  it('falls back to all machines when no operations are configured in engineering for the part', () => {
    const partNomId = 'unconfigured-part'
    const machineOperations = [
      {
        id: 'op1',
        nomenclature_id: 'other-part',
        machine_type: 'Малий (1200)'
      }
    ]

    const partMachineOps = machineOperations.filter(o => o.nomenclature_id === partNomId)
    const configuredMachineTypes = MACHINE_TYPES.filter(mName => {
      return partMachineOps.some(op => isMachineMatch(op.machine_type, mName))
    })

    expect(configuredMachineTypes).toHaveLength(0)

    // In modal: when configuredMachineTypes is empty, displayedMachineTypes falls back to MACHINE_TYPES
    const displayedMachineTypes = configuredMachineTypes.length === 0 ? MACHINE_TYPES : configuredMachineTypes
    expect(displayedMachineTypes).toEqual(MACHINE_TYPES)
  })

  it('displays all machines when showAllMachines flag is active', () => {
    const configuredMachineTypes = ['CNC 12x8', 'CNC KE XIN - ФЕЯ']
    const showAllMachines = true

    const displayedMachineTypes = (showAllMachines || configuredMachineTypes.length === 0)
      ? MACHINE_TYPES
      : configuredMachineTypes

    expect(displayedMachineTypes).toEqual(MACHINE_TYPES)
  })
})

