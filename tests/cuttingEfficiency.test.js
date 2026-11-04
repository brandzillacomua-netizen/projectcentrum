import { describe, it, expect } from 'vitest'
import {
  parseLastOpTag,
  buildOrderedOperationsList,
  sliceOperationsBetween,
  calculateSlicePlannedMinutes,
  calculateEfficiency,
  getTumblingEstimatedSeconds,
  getReceptionEstimatedSeconds,
  getSortingEstimatedSeconds,
  getShop1EstimatedSeconds
} from '../src/utils/cuttingTimeUtils.js'
import { isDetailItem } from '../src/modules/Nomenclature/components/NomenclatureCardModal/index.jsx'

describe('Cutting Efficiency & Shift Handover Utilities', () => {
  describe('parseLastOpTag', () => {
    it('parses standard [LAST_OP:...] with side, operation and sheets', () => {
      const info = '[REPLACED_BY:Швець Іван (Зміна 2)] [LAST_OP:Сторона: side1 • Операція: уп2 ф2 лінії • Листи: 4]'
      const parsed = parseLastOpTag(info)
      expect(parsed).not.toBeNull()
      expect(parsed.side).toBe('side1')
      expect(parsed.operation).toBe('уп2 ф2 лінії')
      expect(parsed.sheet).toBe(4)
    })

    it('handles legacy or custom formats gracefully', () => {
      const info = '[LAST_OP:уп1 ф3 отвори]'
      const parsed = parseLastOpTag(info)
      expect(parsed).not.toBeNull()
      expect(parsed.operation).toBe('уп1 ф3 отвори')
    })

    it('returns null when tag is absent', () => {
      expect(parseLastOpTag('')).toBeNull()
      expect(parseLastOpTag('Some random card info')).toBeNull()
      expect(parseLastOpTag(null)).toBeNull()
    })
  })

  describe('buildOrderedOperationsList', () => {
    it('combines side1, side2, and side2_cut operations ignoring cutters', () => {
      const machineOp = {
        side1_ops: ['уп1 ф3 отвори', '__CUTTER__:cid1:1', 'уп2 ф2 лінії'],
        side2_ops: ['уп3 ф6 фаска'],
        side2_cut_ops: ['__CUTTER__:cid2:2', 'уп4 ф2 вирізка']
      }
      const list = buildOrderedOperationsList(machineOp)
      expect(list.length).toBe(4)
      expect(list[0]).toEqual({ name: 'уп1 ф3 отвори', side: 'side1', index: 0 })
      expect(list[1]).toEqual({ name: 'уп2 ф2 лінії', side: 'side1', index: 1 })
      expect(list[2]).toEqual({ name: 'уп3 ф6 фаска', side: 'side2', index: 2 })
      expect(list[3]).toEqual({ name: 'уп4 ф2 вирізка', side: 'side2_cut', index: 3 })
    })
  })

  describe('sliceOperationsBetween', () => {
    const ordered = [
      { name: 'op1', side: 'side1', index: 0 },
      { name: 'op2', side: 'side1', index: 1 },
      { name: 'op3', side: 'side2', index: 2 },
      { name: 'op4', side: 'side2_cut', index: 3 }
    ]

    it('slices from beginning to first handover', () => {
      const slice = sliceOperationsBetween(ordered, null, 'op2')
      expect(slice.map(o => o.name)).toEqual(['op1', 'op2'])
    })

    it('slices from previous handover to next handover', () => {
      const slice = sliceOperationsBetween(ordered, 'op2', 'op3')
      expect(slice.map(o => o.name)).toEqual(['op3'])
    })

    it('slices from last handover to completion', () => {
      const slice = sliceOperationsBetween(ordered, 'op2', null)
      expect(slice.map(o => o.name)).toEqual(['op3', 'op4'])
    })

    it('returns all operations when no handovers occurred', () => {
      const slice = sliceOperationsBetween(ordered, null, null)
      expect(slice.map(o => o.name)).toEqual(['op1', 'op2', 'op3', 'op4'])
    })
  })

  describe('calculateSlicePlannedMinutes', () => {
    const timings = {
      op1: { '1': 10, '2': 18, '4': 32 },
      op2: { '1': 5, '2': 9, '4': 16 },
      op3: { '1': 20, '2': 35 }
    }

    it('sums exact sheet timings for slice', () => {
      const slice = [{ name: 'op1' }, { name: 'op2' }]
      const plan = calculateSlicePlannedMinutes(slice, timings, 2)
      expect(plan).toBe(27) // 18 + 9
    })

    it('interpolates sheet timing when specific sheet not present', () => {
      const slice = [{ name: 'op3' }]
      // For 4 sheets: 1-sheet rate is 20 => 20 * 4 = 80
      const plan = calculateSlicePlannedMinutes(slice, timings, 4)
      expect(plan).toBe(80)
    })
  })

  describe('calculateEfficiency', () => {
    it('calculates efficiency percentage and delta', () => {
      // 120 planned minutes, 100 fact minutes => 120% efficiency, +20 min delta
      const res = calculateEfficiency(120, 100)
      expect(res.efficiencyPercent).toBe(120)
      expect(res.deltaMinutes).toBe(20)
      expect(res.deltaHours).toBe(0.3)
      expect(res.status).toBe('excellent')
    })

    it('flags slower performance (<80%)', () => {
      // 60 planned minutes, 100 fact minutes => 60% efficiency, -40 min delta
      const res = calculateEfficiency(60, 100)
      expect(res.efficiencyPercent).toBe(60)
      expect(res.deltaMinutes).toBe(-40)
      expect(res.status).toBe('slow')
    })
  })

  describe('Shop 1 (Tumbling, Reception, Sorting, Total) Estimations', () => {
    const sampleNom = {
      rule_params: {
        operation_timings: {
          'CNC KE XIN - 4 - 16 листів (ФЕЯ)': {
            'уп1': { 4: 40 },
            'уп2': { 4: 20 }
          }
        },
        tumbling_operation_timings: {
          'Галтовка (Вібростіл)': { 4: 15 },
          'Галтовка (Мийка)': { 4: 5 }
        },
        reception_operation_timings: {
          'Прийомка (Контроль якості та відбраковка)': { 4: 10 }
        },
        sorting_operation_timings: {
          'Сортування (Сортування та перевірка партій)': { 4: 12 }
        }
      }
    }

    it('calculates tumbling planned seconds', () => {
      const sec = getTumblingEstimatedSeconds(sampleNom, 4)
      expect(sec).toBe(20 * 60) // 15 + 5 = 20 min = 1200 sec
    })

    it('calculates reception planned seconds', () => {
      const sec = getReceptionEstimatedSeconds(sampleNom, 4)
      expect(sec).toBe(10 * 60) // 10 min = 600 sec
    })

    it('calculates sorting planned seconds', () => {
      const sec = getSortingEstimatedSeconds(sampleNom, 4)
      expect(sec).toBe(12 * 60) // 12 min = 720 sec
    })

    it('calculates total Shop 1 planned seconds', () => {
      const totalSec = getShop1EstimatedSeconds(sampleNom, 4, 100, 'CNC KE XIN - 4 - 16 листів (ФЕЯ)')
      // Cutting = 60 min (3600s), Tumbling = 20 min (1200s), Reception = 10 min (600s), Sorting = 12 min (720s)
      // Total = 102 min = 6120s
      expect(totalSec).toBe((60 + 20 + 10 + 12) * 60)
    })
  })

  describe('isDetailItem category guard', () => {
    const groups = [
      { id: 'cat_raw', code: 'RAW', name: '01. Сировина' },
      { id: 'cat_hw', code: 'HW', name: '02. Метизи' },
      { id: 'cat_parts', code: 'PARTS', name: '03. Деталі' },
      { id: 'cat_fg', code: 'FG', name: '04. Готова продукція' }
    ]

    it('returns true for items in 03. Деталі group', () => {
      const detail = { id: 'd1', name: 'Київ деталь', group_id: 'cat_parts', type: 'part' }
      expect(isDetailItem(detail, groups)).toBe(true)
    })

    it('returns true for items with rule_type frame_part', () => {
      const detail = { id: 'd2', name: 'Проставка', rule_type: 'frame_part' }
      expect(isDetailItem(detail, groups)).toBe(true)
    })

    it('returns false for raw materials (01. Сировина)', () => {
      const raw = { id: 'r1', name: 'Лист карбону 3мм', group_id: 'cat_raw', type: 'raw' }
      expect(isDetailItem(raw, groups)).toBe(false)
    })

    it('returns false for hardware (02. Метизи)', () => {
      const hw = { id: 'h1', name: 'Гвинт М3х10', group_id: 'cat_hw', type: 'hardware' }
      expect(isDetailItem(hw, groups)).toBe(false)
    })

    it('returns false for finished goods (04. Готова продукція)', () => {
      const fg = { id: 'f1', name: 'Рама дрон Київ 7', group_id: 'cat_fg', type: 'product' }
      expect(isDetailItem(fg, groups)).toBe(false)
    })

    it('returns false for null or undefined item', () => {
      expect(isDetailItem(null)).toBe(false)
      expect(isDetailItem(undefined)).toBe(false)
    })
  })
})
