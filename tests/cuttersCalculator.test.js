import { describe, it, expect } from 'vitest'
import {
  calculateCuttersForBatch,
  resolveCutterOrVirtualType,
  STANDARD_CUTTER_TYPES
} from '../src/utils/cutterCalculator.js'

describe('Cutter Calculator & Virtual Cutter Types Suite', () => {
  it('resolves STANDARD_CUTTER_TYPES by id and name', () => {
    const f2 = resolveCutterOrVirtualType('type_f2', [])
    expect(f2).toBeDefined()
    expect(f2.name).toBe('Тип Ф2')
    expect(f2.material_type).toBe('2')

    const f3 = resolveCutterOrVirtualType('type_f3', [])
    expect(f3).toBeDefined()
    expect(f3.name).toBe('Тип Ф3')
    expect(f3.material_type).toBe('3')

    const f15 = resolveCutterOrVirtualType('type_f15', [])
    expect(f15).toBeDefined()
    expect(f15.name).toBe('Тип Ф1.5')
  })

  it('calculates cutter rows from machineOperations side2_cut_ops containing virtual types', () => {
    const partNom = {
      id: '16baa960-da47-4f07-bae3-2099b92abfc0',
      name: 'Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39'
    }

    const machineOperations = [
      {
        nomenclature_id: '16baa960-da47-4f07-bae3-2099b92abfc0',
        machine_type: 'CNC 1200x800 - 4 листи (Малий)',
        side2_cut_ops: ['__CUTTER__:type_f2:1', '__CUTTER__:type_f3:3']
      }
    ]

    const cutterRows = calculateCuttersForBatch({
      partNom,
      machineName: 'CNC 12x8 (місткість за замовчуванням: 4 л.)',
      sheets: 3,
      task: { id: 'task-1', plan_snapshot: {} },
      machineOperations,
      nomenclatures: [],
      inventory: []
    })

    expect(cutterRows).toHaveLength(2)
    const rowF2 = cutterRows.find(r => r.name === 'Тип Ф2')
    const rowF3 = cutterRows.find(r => r.name === 'Тип Ф3')

    expect(rowF2).toBeDefined()
    expect(rowF2.qty).toBe(3) // 3 sheets * 1 qty/sheet

    expect(rowF3).toBeDefined()
    expect(rowF3.qty).toBe(9) // 3 sheets * 3 qty/sheet
  })
})
