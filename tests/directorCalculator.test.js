import { describe, it, expect } from 'vitest'
import {
  getFinishedProducts,
  getBOMPartsForProduct,
  calculateProductBreakdown,
  calculateMaterialSummary,
  findRawStockForMaterial
} from '../src/modules/Director/calculator/utils/calculatorHelpers.js'

describe('Director Product Calculator Helpers', () => {
  const mockNomenclatures = [
    { id: 'p1', name: 'Рама KHARAК 10', type: 'product' },
    { id: 'p2', name: 'Комплект карбонової рами V2', type: 'product' },
    { id: 'part1', name: 'ІП-77-Marun-V2-Фп-3-14', material_type: 'Лист (3мм)', units_per_sheet: 14, type: 'part' },
    { id: 'part2', name: 'ІП-77-Marun-V2-П-8-50', material_type: 'Лист (8мм)', units_per_sheet: 50, type: 'part' },
    { id: 'part3', name: 'ІП-77-Marun-V2-В-2-14', material_type: 'Лист (2мм)', units_per_sheet: 14, type: 'part' },
    { id: 'hw1', name: 'Болт М3х10', type: 'hardware' }
  ]

  const mockBomItems = [
    { parent_id: 'p1', child_id: 'part1', quantity_per_parent: 1 },
    { parent_id: 'p1', child_id: 'part2', quantity_per_parent: 4 },
    { parent_id: 'p1', child_id: 'part3', quantity_per_parent: 1 },
    { parent_id: 'p1', child_id: 'hw1', quantity_per_parent: 8 }
  ]

  const mockInventory = [
    // SGP stock of finished parts
    { nomenclature_id: 'part1', type: 'finished', warehouse: 'sgp', total_qty: 200, reserved_qty: 0 },
    // Raw sheets in warehouse
    { name: 'Лист Т300 (3мм)', type: 'raw', warehouse: 'raw', total_qty: 1500, reserved_qty: 100 },
    { name: 'Лист Т300 (8мм)', type: 'raw', warehouse: 'raw', total_qty: 500, reserved_qty: 50 },
    { name: 'Лист Т300 (2мм)', type: 'raw', warehouse: 'raw', total_qty: 800, reserved_qty: 0 }
  ]

  it('filters finished products correctly', () => {
    const products = getFinishedProducts(mockNomenclatures, mockBomItems)
    expect(products.map(p => p.id)).toEqual(['p2', 'p1']) // sorted by name
  })

  it('retrieves BOM parts excluding pure hardware in breakdown', () => {
    const parts = getBOMPartsForProduct('p1', mockBomItems, mockNomenclatures)
    expect(parts.length).toBe(4) // 3 parts + 1 hardware in raw BOM

    const { rows, totals } = calculateProductBreakdown({
      items: [{ productNom: mockNomenclatures[0], quantity: 1000 }],
      useSGPStock: true,
      inventory: mockInventory,
      bomItems: mockBomItems,
      nomenclatures: mockNomenclatures
    })

    // Hardware was filtered out from cutting table
    expect(rows.length).toBe(3)

    // Part 1: need 1000, inStock 200 => plan 800. unitsPerSheet 14 => sheets = ceil(800/14) = 58
    const r1 = rows.find(r => r.nomId === 'part1')
    expect(r1.totalNeeded).toBe(1000)
    expect(r1.inStockBZ).toBe(200)
    expect(r1.planQty).toBe(800)
    expect(r1.unitsPerSheet).toBe(14)
    expect(r1.totalSheets).toBe(58)
    expect(r1.bzSurplus).toBe(58 * 14 - 800) // 812 - 800 = 12 surplus

    // Part 2: qty 4 per parent => need 4000, inStock 0 => plan 4000. unitsPerSheet 50 => sheets = 4000 / 50 = 80
    const r2 = rows.find(r => r.nomId === 'part2')
    expect(r2.totalNeeded).toBe(4000)
    expect(r2.planQty).toBe(4000)
    expect(r2.unitsPerSheet).toBe(50)
    expect(r2.totalSheets).toBe(80)
    expect(r2.bzSurplus).toBe(0)

    // Check totals
    expect(totals.totalNeeded).toBe(6000) // 1000 + 4000 + 1000
    expect(totals.totalInStock).toBe(200)
    expect(totals.totalPlan).toBe(5800)
  })

  it('correctly ignores SGP stock when useSGPStock is false', () => {
    const { rows } = calculateProductBreakdown({
      items: [{ productNom: mockNomenclatures[0], quantity: 1000 }],
      useSGPStock: false,
      inventory: mockInventory,
      bomItems: mockBomItems,
      nomenclatures: mockNomenclatures
    })

    const r1 = rows.find(r => r.nomId === 'part1')
    expect(r1.totalNeeded).toBe(1000)
    expect(r1.inStockBZ).toBe(0)
    expect(r1.planQty).toBe(1000)
    expect(r1.totalSheets).toBe(Math.ceil(1000 / 14)) // 72 sheets
  })

  it('aggregates materials by name and thickness correctly', () => {
    const { rows } = calculateProductBreakdown({
      items: [{ productNom: mockNomenclatures[0], quantity: 1000 }],
      useSGPStock: true,
      inventory: mockInventory,
      bomItems: mockBomItems,
      nomenclatures: mockNomenclatures
    })

    const { materials, thicknesses } = calculateMaterialSummary(rows, mockInventory)

    expect(materials.length).toBe(3)
    // Thicknesses: 2мм, 3мм, 8мм
    expect(thicknesses.map(t => t.thickness)).toEqual(['2', '3', '8'])

    // Stock verification
    const mat3mm = materials.find(m => m.thickness === '3')
    expect(mat3mm.name).toBe('Лист Т300 (3мм)')
    expect(mat3mm.sheets).toBe(58)
    expect(mat3mm.stockAvailable).toBe(1400) // 1500 - 100
    expect(mat3mm.hasEnough).toBe(true)
    expect(mat3mm.deficit).toBe(0)
  })

  it('finds raw stock for material accurately', () => {
    const stock3 = findRawStockForMaterial('Т300', '3', mockInventory)
    expect(stock3).toBe(1400)

    const stock8 = findRawStockForMaterial('Т300', '8', mockInventory)
    expect(stock8).toBe(450)
  })

  it('correctly resolves BOM parts using legacy_ids and nomenclature_code', () => {
    const noms = [
      { id: 'v2-new-id', legacy_ids: ['legacy-old-id'], nomenclature_code: 'V2-90836', name: '(інд.проект 77)', type: 'product' },
      { id: 'child-1', legacy_ids: ['leg-c1'], name: 'ІП-77-Marun-V2-Фп-3-14', type: 'part' }
    ]
    // bom_item links old legacy ID
    const boms = [
      { parent_id: 'legacy-old-id', child_id: 'leg-c1', quantity_per_parent: 1 }
    ]

    const parts = getBOMPartsForProduct('v2-new-id', boms, noms)
    expect(parts.length).toBe(1)
    expect(parts[0].nom.name).toBe('ІП-77-Marun-V2-Фп-3-14')

    const { rows } = calculateProductBreakdown({
      items: [{ productNom: noms[0], quantity: 1000 }],
      useSGPStock: false,
      inventory: [],
      bomItems: boms,
      nomenclatures: noms
    })
    expect(rows.length).toBe(1)
    expect(rows[0].unitsPerSheet).toBe(14) // parsed from "-14" in name
    expect(rows[0].totalSheets).toBe(Math.ceil(1000 / 14)) // 72
  })
})

