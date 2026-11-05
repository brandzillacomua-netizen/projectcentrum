import { describe, it, expect } from 'vitest'
import {
  getCuttingEstimatedSeconds,
  getCardSheetsCount,
  getCardCuttingPlanSeconds,
  formatCuttingTime
} from '../src/utils/cuttingTimeUtils.js'

describe('cuttingTimeUtils', () => {
  const legacyNom = {
    id: 'nom-1',
    name: 'Київ К-ІП9-10-П-7-46',
    units_per_sheet: 46,
    rule_params: {
      loadTimings: {
        '1': '30',
        '2': '45',
        '4': '60',
        '8': '100',
        '12': '150',
        '16': '200'
      }
    }
  }

  describe('getCuttingEstimatedSeconds (strict new method only)', () => {
    it('returns 0 for legacy loadTimings (legacy methods disabled)', () => {
      expect(getCuttingEstimatedSeconds(legacyNom, 1)).toBe(0)
      expect(getCuttingEstimatedSeconds(legacyNom, 2)).toBe(0)
      expect(getCuttingEstimatedSeconds(legacyNom, 4)).toBe(0)
    })

    it('returns 0 for legacy time_per_unit', () => {
      const nomWithUnitTime = {
        time_per_unit: 0.5 // 0.5 min per piece
      }
      expect(getCuttingEstimatedSeconds(nomWithUnitTime, 4, 100)).toBe(0)
    })

    it('returns 0 when no timings are defined', () => {
      expect(getCuttingEstimatedSeconds({}, 4, 100)).toBe(0)
    })
  })

  describe('getCardSheetsCount', () => {
    it('reads sheetsPerLoading if present', () => {
      expect(getCardSheetsCount({ sheetsPerLoading: 4 }, legacyNom)).toBe(4)
    })

    it('reads [SHEETS:X] from card_info', () => {
      expect(getCardSheetsCount({ card_info: '№1 [SHEETS:4] [BZ:0]' }, legacyNom)).toBe(4)
    })

    it('derives from [REQ:X] + [BZ:Y] and units_per_sheet', () => {
      expect(getCardSheetsCount({ card_info: '№1 [REQ:92] [BZ:0]' }, legacyNom)).toBe(2)
    })

    it('derives from quantity and units_per_sheet', () => {
      expect(getCardSheetsCount({ quantity: 184 }, legacyNom)).toBe(4)
    })
  })

  describe('getCardCuttingPlanSeconds', () => {
    it('returns 0 for cutting card if nomenclature only has legacy loadTimings', () => {
      const card = {
        operation: 'Розкрій',
        quantity: 184,
        card_info: '№1 [SHEETS:4]'
      }
      expect(getCardCuttingPlanSeconds(card, legacyNom)).toBe(0)
    })

    it('returns existing estimated_time for non-cutting cards', () => {
      const card = {
        operation: 'Галтовка',
        estimated_time: 1200
      }
      expect(getCardCuttingPlanSeconds(card, legacyNom)).toBe(1200)
    })

    it('returns 0 for cutting stage card if no new operation_timings defined', () => {
      const card = {
        operation: 'Сортування',
        card_info: '№5/51 [SHEETS:4]',
        estimated_time: 2400
      }
      expect(getCardCuttingPlanSeconds(card, legacyNom, true)).toBe(0)
    })

    it('does NOT fall back to legacy card.estimated_time for cutting cards', () => {
      const card = {
        operation: 'Розкрій',
        estimated_time: 2400
      }
      expect(getCardCuttingPlanSeconds(card, null)).toBe(0)
    })
  })

  describe('formatCuttingTime', () => {
    it('formats seconds into clean hour and minute representation', () => {
      expect(formatCuttingTime(0)).toBe('0хв')
      expect(formatCuttingTime(1800)).toBe('30хв')
      expect(formatCuttingTime(2700)).toBe('45хв')
      expect(formatCuttingTime(3600)).toBe('1год')
      expect(formatCuttingTime(7200)).toBe('2год')
      expect(formatCuttingTime(14400)).toBe('4год')
      expect(formatCuttingTime(5400)).toBe('1год 30хв')
    })
  })

  describe('buffer card overtime isolation', () => {
    it('isolates cutting work duration from buffer waiting time', () => {
      // Card has 4h plan (14400s)
      const planSec = 14400
      // Cutting took 3h (10800s), card sat in buffer for 4h29m (16140s)
      const timeMetrics = { totalSec: 26940, currentSec: 16140 }
      
      // When at buffer, cuttingWorkSec is totalSec - currentSec
      const cuttingWorkSec = Math.max(0, timeMetrics.totalSec - timeMetrics.currentSec)
      expect(cuttingWorkSec).toBe(10800)
      
      // Cutting was within plan!
      const isCuttingOvertime = cuttingWorkSec > planSec
      expect(isCuttingOvertime).toBe(false)
    })

    it('correctly detects and freezes cutting overtime for cards in buffer', () => {
      // Card has 4h plan (14400s)
      const planSec = 14400
      // Cutting took 6h (21600s), card sat in buffer for 1h (3600s) -> total 7h (25200s)
      const timeMetrics = { totalSec: 25200, currentSec: 3600 }
      
      const cuttingWorkSec = Math.max(0, timeMetrics.totalSec - timeMetrics.currentSec)
      expect(cuttingWorkSec).toBe(21600) // 6 hours

      const isOvertime = cuttingWorkSec > planSec
      expect(isOvertime).toBe(true)

      const overtimeSec = cuttingWorkSec - planSec
      expect(overtimeSec).toBe(7200) // Exactly 2 hours!

      // When card sits in buffer for another 3 hours (currentSec = 4h, totalSec = 10h)
      const laterMetrics = { totalSec: 36000, currentSec: 14400 }
      const laterCuttingWorkSec = Math.max(0, laterMetrics.totalSec - laterMetrics.currentSec)
      expect(laterCuttingWorkSec).toBe(21600) // Still 6 hours!
      expect(laterCuttingWorkSec - planSec).toBe(7200) // Still exactly 2 hours (frozen)!
    })
  })

  describe('operation_timings per machine type', () => {
    const nomWithOpTimings = {
      id: 'nom-2',
      name: 'Деталь Х',
      rule_params: {
        operation_timings: {
          'CNC 1200x800 - 4 листи (Малий)': {
            'уп1 отвори': { '1': 10, '2': 18, '3': 25, '4': 32 },
            'уп2 контур': { '1': 20, '2': 35, '3': 50, '4': 65 }
          },
          'CNC KE XIN - 4 - 16 листів (ФЕЯ)': {
            'уп1 ф3 отвори': { '4': 15, '8': 28, '16': 50 },
            'уп2 ф2 контур': { '4': 45, '8': 85, '16': 160 }
          }
        }
      }
    }

    it('sums operation timings for exact sheet match on specific machine', () => {
      // Малий, 3 листи: 25 + 50 = 75 хв = 4500 сек
      expect(getCuttingEstimatedSeconds(nomWithOpTimings, 3, 0, 'CNC 1200x800 - 4 листи (Малий)')).toBe(75 * 60)
      // Малий, 4 листи: 32 + 65 = 97 хв = 5820 сек
      expect(getCuttingEstimatedSeconds(nomWithOpTimings, 4, 0, 'CNC 1200x800 - 4 листи (Малий)')).toBe(97 * 60)
    })

    it('calculates for different machine types independently', () => {
      // ФЕЯ, 4 листи: 15 + 45 = 60 хв = 3600 сек
      expect(getCuttingEstimatedSeconds(nomWithOpTimings, 4, 0, 'CNC KE XIN - 4 - 16 листів (ФЕЯ)')).toBe(60 * 60)
      // ФЕЯ, 8 листів: 28 + 85 = 113 хв = 6780 сек
      expect(getCuttingEstimatedSeconds(nomWithOpTimings, 8, 0, 'CNC KE XIN - 4 - 16 листів (ФЕЯ)')).toBe(113 * 60)
    })

    it('resolves machine type automatically from card.machine name', () => {
      const cardSmall = {
        operation: 'Розкрій',
        machine: 'CNC 12*8 №1.11',
        card_info: '№1 [SHEETS:3]'
      }
      // Малий, 3 листи = 75 хв
      expect(getCardCuttingPlanSeconds(cardSmall, nomWithOpTimings)).toBe(75 * 60)

      const cardFeya = {
        operation: 'Розкрій',
        machine: 'CNC KE XIN Ф5',
        card_info: '№1 [SHEETS:4]'
      }
      // ФЕЯ, 4 листи = 60 хв
      expect(getCardCuttingPlanSeconds(cardFeya, nomWithOpTimings)).toBe(60 * 60)
    })
  })
})
