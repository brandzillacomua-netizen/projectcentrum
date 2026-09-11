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

  it('groups multiple operations referencing physical cutters into single Cutter Type rows', () => {
    const partNom = {
      id: 'part-uuid-1',
      name: 'Деталь Тестова'
    }

    const mockNoms = [
      { id: 'cut-1', name: 'Фреза двопера 3,175x3,175x42x65', type: 'consumable' },
      { id: 'cut-2', name: 'Фреза двопера 3,175x12x38', type: 'consumable' },
      { id: 'cut-3', name: 'Фреза фасочна 6x38x90°', type: 'consumable' },
      { id: 'cut-4', name: 'Фреза фасочна 6x38x120°', type: 'consumable' }
    ]

    const machineOperations = [
      {
        nomenclature_id: 'part-uuid-1',
        machine_type: 'CNC 1200x800 - 4 листи (Малий)',
        side2_cut_ops: [
          '__CUTTER__:cut-1:1',
          '__CUTTER__:cut-2:2',
          '__CUTTER__:cut-3:1',
          '__CUTTER__:cut-4:1'
        ]
      }
    ]

    const cutterRows = calculateCuttersForBatch({
      partNom,
      machineName: 'CNC 12x8',
      sheets: 4,
      task: { id: 'task-1' },
      machineOperations,
      nomenclatures: mockNoms,
      inventory: []
    })

    // cut-1 (1 qty) + cut-2 (2 qty) both resolve to 'Тип Ф3.175' => merged to 1 row with 3 * 4 = 12 total
    // cut-3 resolves to 'Тип Ф6 (90°)' => 1 * 4 = 4 total
    // cut-4 resolves to 'Тип Ф6 (120°)' => 1 * 4 = 4 total
    expect(cutterRows).toHaveLength(3)

    const row3175 = cutterRows.find(r => r.name === 'Тип Ф3.175')
    const row6_90 = cutterRows.find(r => r.name === 'Тип Ф6 (90°)')
    const row6_120 = cutterRows.find(r => r.name === 'Тип Ф6 (120°)')

    expect(row3175).toBeDefined()
    expect(row3175.qty).toBe(12)

    expect(row6_90).toBeDefined()
    expect(row6_90.qty).toBe(4)

    expect(row6_120).toBeDefined()
    expect(row6_120.qty).toBe(4)
  })
})

