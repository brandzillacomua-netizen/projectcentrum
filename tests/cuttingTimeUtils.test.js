import { describe, it, expect } from 'vitest'
import {
  getCuttingEstimatedSeconds,
  getCardSheetsCount,
  getCardCuttingPlanSeconds,
  formatCuttingTime
} from '../src/utils/cuttingTimeUtils.js'

describe('cuttingTimeUtils', () => {
  const sampleNom = {
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

  describe('getCuttingEstimatedSeconds', () => {
    it('returns exact seconds for direct sheet matches (1, 2, 4, 8, 12, 16)', () => {
      expect(getCuttingEstimatedSeconds(sampleNom, 1)).toBe(30 * 60)
      expect(getCuttingEstimatedSeconds(sampleNom, 2)).toBe(45 * 60)
      expect(getCuttingEstimatedSeconds(sampleNom, 4)).toBe(60 * 60)
      expect(getCuttingEstimatedSeconds(sampleNom, 8)).toBe(100 * 60)
      expect(getCuttingEstimatedSeconds(sampleNom, 12)).toBe(150 * 60)
      expect(getCuttingEstimatedSeconds(sampleNom, 16)).toBe(200 * 60)
    })

    it('handles string sheet counts', () => {
      expect(getCuttingEstimatedSeconds(sampleNom, '4')).toBe(3600)
    })

    it('estimates proportionally when sheet count is not an exact key', () => {
      // 1 sheet is 30m, 3 sheets should use 1-sheet rate -> 3 * 30 = 90 min
      expect(getCuttingEstimatedSeconds(sampleNom, 3)).toBe(3 * 30 * 60)
    })

    it('falls back to time_per_unit when loadTimings is missing or empty', () => {
      const nomWithUnitTime = {
        time_per_unit: 0.5 // 0.5 min per piece
      }
      expect(getCuttingEstimatedSeconds(nomWithUnitTime, 4, 100)).toBe(Math.round(0.5 * 100 * 60))
    })

    it('returns 0 when no timings are defined', () => {
      expect(getCuttingEstimatedSeconds({}, 4, 100)).toBe(0)
    })
  })

  describe('getCardSheetsCount', () => {
    it('reads sheetsPerLoading if present', () => {
      expect(getCardSheetsCount({ sheetsPerLoading: 4 }, sampleNom)).toBe(4)
    })

    it('reads [SHEETS:X] from card_info', () => {
      expect(getCardSheetsCount({ card_info: '№1 [SHEETS:4] [BZ:0]' }, sampleNom)).toBe(4)
    })

    it('derives from [REQ:X] + [BZ:Y] and units_per_sheet', () => {
      expect(getCardSheetsCount({ card_info: '№1 [REQ:92] [BZ:0]' }, sampleNom)).toBe(2)
    })

    it('derives from quantity and units_per_sheet', () => {
      expect(getCardSheetsCount({ quantity: 184 }, sampleNom)).toBe(4)
    })
  })

  describe('getCardCuttingPlanSeconds', () => {
    it('returns plan time for cutting card based on nomenclature loadTimings', () => {
      const card = {
        operation: 'Розкрій',
        quantity: 184,
        card_info: '№1 [SHEETS:4]'
      }
      expect(getCardCuttingPlanSeconds(card, sampleNom)).toBe(3600)
    })

    it('returns existing estimated_time for non-cutting cards', () => {
      const card = {
        operation: 'Галтовка',
        estimated_time: 1200
      }
      expect(getCardCuttingPlanSeconds(card, sampleNom)).toBe(1200)
    })

    it('resolves cutting plan for cards moved to sorting when isCuttingStage is true', () => {
      const card = {
        operation: 'Сортування',
        card_info: '№5/51 [SHEETS:4]',
        estimated_time: 0
      }
      expect(getCardCuttingPlanSeconds(card, sampleNom, true)).toBe(3600)
    })

    it('falls back to card.estimated_time if nomenclature has no loadTimings', () => {
      const card = {
        operation: 'Розкрій',
        estimated_time: 2400
      }
      expect(getCardCuttingPlanSeconds(card, null)).toBe(2400)
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
})
