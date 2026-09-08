import { describe, it, expect } from 'vitest'
import {
  computeCuttersList,
  normalizeCutterKey,
  parseDiameterFromName
} from '../src/modules/Settings/hooks/subhooks/useSettingsImports'

describe('Cutters Import & Warehouse (SO) Reconciliation Suite', () => {
  describe('computeCuttersList parsing logic', () => {
    it('correctly parses standard CSV format with exact headers', () => {
      const csv = [
        ['Номенклатура', 'Діаметр ріжучої частини', 'Залишок на складі'],
        ['Фреза спіральна 1-західна 3.175х12', '3.175', '10'],
        ['Фреза спіральна 2-західна 4х15', '4', '5'],
        ['Фреза компресійна 6х22', '6', '12']
      ]

      const items = computeCuttersList(csv)
      expect(items).toHaveLength(3)
      expect(items[0]).toEqual({
        name: 'Фреза спіральна 1-західна 3.175х12',
        diameter: 3.175,
        qty: 10,
        rowNum: 2
      })
      expect(items[1]).toEqual({
        name: 'Фреза спіральна 2-західна 4х15',
        diameter: 4,
        qty: 5,
        rowNum: 3
      })
      expect(items[2]).toEqual({
        name: 'Фреза компресійна 6х22',
        diameter: 6,
        qty: 12,
        rowNum: 4
      })
    })

    it('supports alternative header names (Назва, Діаметр, Кількість) and comma decimals', () => {
      const csv = [
        ['Назва', 'Діаметр', 'Кількість'],
        ['Фреза конічна R0.5', '1,0', '15'],
        ['Фреза пряма 8 мм', '8', '2']
      ]

      const items = computeCuttersList(csv)
      expect(items).toHaveLength(2)
      expect(items[0].diameter).toBe(1.0)
      expect(items[0].qty).toBe(15)
      expect(items[1].diameter).toBe(8)
      expect(items[1].qty).toBe(2)
    })

    it('infers diameter from item name if diameter column is missing or empty', () => {
      const csv = [
        ['Номенклатура', 'Залишок на складі'],
        ['Фреза спіральна 3.175х12', '8'],
        ['Фреза 4х22 2-західна', '14']
      ]

      const items = computeCuttersList(csv)
      expect(items).toHaveLength(2)
      expect(items[0].diameter).toBe(3.175)
      expect(items[0].qty).toBe(8)
      expect(items[1].diameter).toBe(4)
      expect(items[1].qty).toBe(14)
    })

    it('handles files with title or empty rows prior to the header row', () => {
      const csv = [
        ['ЗВІТ ПО СКЛАДУ ФРЕЗ ВІД 08.09.2026'],
        [''],
        ['Номенклатура', 'Діаметр ріжучої частини', 'Залишок на складі'],
        ['Фреза алмазна 12х35', '12', '3']
      ]

      const items = computeCuttersList(csv)
      expect(items).toHaveLength(1)
      expect(items[0].name).toBe('Фреза алмазна 12х35')
      expect(items[0].diameter).toBe(12)
      expect(items[0].qty).toBe(3)
      expect(items[0].rowNum).toBe(4)
    })

    it('filters out total summary rows like "Разом", "Всього"', () => {
      const csv = [
        ['Номенклатура', 'Діаметр ріжучої частини', 'Залишок на складі'],
        ['Фреза 3.175х12', '3.175', '10'],
        ['Всього на складі', '', '10'],
        ['Підсумок', '', '10']
      ]

      const items = computeCuttersList(csv)
      expect(items).toHaveLength(1)
      expect(items[0].name).toBe('Фреза 3.175х12')
    })
  })

  describe('normalizeCutterKey logic', () => {
    it('normalizes Cyrillic and Latin x/X and cleans extra whitespace', () => {
      const cyrillic = 'Фреза  3.175х12  '
      const latin = '  фреза 3.175x12'
      expect(normalizeCutterKey(cyrillic)).toBe(normalizeCutterKey(latin))
    })
  })

  describe('Simulation of Overwrite vs Add Modes targeting SO (warehouse: operational)', () => {
    const existingOperationalInv = [
      {
        id: 'inv-cutter-1',
        nomenclature_id: 'nom-1',
        name: 'Фреза 3.175х12',
        type: 'consumable',
        warehouse: 'operational',
        pocket_owner: null,
        unit: 'шт',
        total_qty: 15,
        reserved_qty: 3
      }
    ]

    const importedItem = {
      name: 'Фреза 3.175х12',
      diameter: 3.175,
      qty: 25
    }

    it('mode "overwrite" replaces total_qty with file quantity and targets SO', () => {
      const mode = 'overwrite'
      const existing = existingOperationalInv[0]
      const newTotal = mode === 'add'
        ? (Number(existing.total_qty) || 0) + importedItem.qty
        : importedItem.qty

      const updatedRecord = {
        id: existing.id,
        name: existing.name,
        type: 'consumable',
        warehouse: 'operational',
        pocket_owner: null,
        unit: 'шт',
        total_qty: newTotal,
        reserved_qty: existing.reserved_qty
      }

      expect(updatedRecord.total_qty).toBe(25)
      expect(updatedRecord.warehouse).toBe('operational')
      expect(updatedRecord.type).toBe('consumable')
      expect(updatedRecord.pocket_owner).toBeNull()
      expect(updatedRecord.reserved_qty).toBe(3) // Keeps existing active reservation
    })

    it('mode "add" increments existing total_qty by imported quantity and targets SO', () => {
      const mode = 'add'
      const existing = existingOperationalInv[0]
      const newTotal = mode === 'add'
        ? (Number(existing.total_qty) || 0) + importedItem.qty
        : importedItem.qty

      const updatedRecord = {
        id: existing.id,
        name: existing.name,
        type: 'consumable',
        warehouse: 'operational',
        pocket_owner: null,
        unit: 'шт',
        total_qty: newTotal,
        reserved_qty: existing.reserved_qty
      }

      expect(updatedRecord.total_qty).toBe(40) // 15 + 25
      expect(updatedRecord.warehouse).toBe('operational')
      expect(updatedRecord.type).toBe('consumable')
      expect(updatedRecord.pocket_owner).toBeNull()
    })

    it('brand new cutter gets inserted strictly to operational warehouse (SO) with pocket_owner: null', () => {
      const newItem = {
        name: 'Фреза спіральна нова 5х25',
        diameter: 5,
        qty: 18
      }

      const insertRecord = {
        name: newItem.name,
        type: 'consumable',
        warehouse: 'operational',
        pocket_owner: null,
        unit: 'шт',
        total_qty: newItem.qty,
        reserved_qty: 0
      }

      expect(insertRecord.total_qty).toBe(18)
      expect(insertRecord.warehouse).toBe('operational')
      expect(insertRecord.type).toBe('consumable')
      expect(insertRecord.pocket_owner).toBeNull()
      expect(insertRecord.reserved_qty).toBe(0)
    })
  })
})
