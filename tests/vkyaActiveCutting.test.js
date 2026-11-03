import { describe, expect, it } from 'vitest'
import {
  isCardInCutting,
  getActiveCuttingCards,
  resolveCardMachineType,
  MACHINE_TYPE_CATEGORIES,
  matchesInspectionTier,
  countCardsByMachineType
} from '../src/modules/Brak/components/modals/BrakActiveCuttingModal.jsx'

describe('VKYA Active Cutting Cards Detection', () => {
  it('correctly identifies cards actively in cutting', () => {
    const activeCuttingCard = {
      id: 'card-1',
      status: 'in-progress',
      operation: 'Розкрій',
      machine: 'CNC KE XIN - ФЕЯ'
    }
    expect(isCardInCutting(activeCuttingCard)).toBe(true)
  })

  it('identifies paused cutting cards on CNC machines', () => {
    const pausedCard = {
      id: 'card-2',
      status: 'paused',
      operation: 'Розкрій',
      machine: 'CNC 12x8 №1.7'
    }
    expect(isCardInCutting(pausedCard)).toBe(true)
  })

  it('rejects completed or scrapped cards', () => {
    const completedCard = {
      id: 'card-3',
      status: 'completed',
      operation: 'Розкрій',
      machine: 'CNC KE XIN'
    }
    expect(isCardInCutting(completedCard)).toBe(false)

    const scrappedCard = {
      id: 'card-4',
      status: 'scrapped',
      operation: 'Розкрій',
      machine: 'CNC KE XIN'
    }
    expect(isCardInCutting(scrappedCard)).toBe(false)
  })

  it('rejects cards that are in tumbling, sorting or SGP', () => {
    const tumblingCard = {
      id: 'card-5',
      status: 'in-progress',
      operation: 'Галтовка',
      machine: 'Вібростіл'
    }
    expect(isCardInCutting(tumblingCard)).toBe(false)

    const sortingCard = {
      id: 'card-6',
      status: 'in-progress',
      operation: 'Сортування',
      machine: 'Стіл 1'
    }
    expect(isCardInCutting(sortingCard)).toBe(false)

    const sgpCard = {
      id: 'card-7',
      status: 'in-progress',
      operation: 'Склад СГП',
      card_info: '[ЗІ СКЛАДУ СГП]'
    }
    expect(isCardInCutting(sgpCard)).toBe(false)
  })

  it('rejects Shop 2 automatic cards and non-part nomenclatures', () => {
    const shop2AutoCard = {
      id: 'card-shop2',
      status: 'in-progress',
      operation: 'Розкрій',
      card_info: '[ЦЕХ №2] Автоматично'
    }
    expect(isCardInCutting(shop2AutoCard)).toBe(false)

    const nonPartCard = {
      id: 'card-box',
      status: 'in-progress',
      operation: 'Розкрій',
      nomenclature_id: 'nom-box'
    }
    const nomMap = new Map([['nom-box', { id: 'nom-box', type: 'box' }]])
    expect(isCardInCutting(nonPartCard, nomMap)).toBe(false)
  })

  it('getActiveCuttingCards deduplicates cards by id matching Shop 1 Terminal parity', () => {
    const card1 = { id: 'card-dup', status: 'in-progress', operation: 'Розкрій' }
    const cardDup = { id: 'card-dup', status: 'in-progress', operation: 'Розкрій' }
    const card2 = { id: 'card-unique', status: 'in-progress', operation: 'Розкрій' }

    const result = getActiveCuttingCards([card1, cardDup, card2])
    expect(result).toHaveLength(2)
    expect(result.map(c => c.id)).toEqual(['card-dup', 'card-unique'])
  })

  describe('resolveCardMachineType category classification', () => {
    it('classifies CNC 12x8 variants as malyi (Малий)', () => {
      expect(resolveCardMachineType({ machine: 'CNC 12×8 №1.15' })).toBe('malyi')
      expect(resolveCardMachineType({ machine: 'CNC 12x8 №1.7' })).toBe('malyi')
      expect(resolveCardMachineType({ machine: 'CNC 1200x800 (Малий)' })).toBe('malyi')
    })

    it('classifies KE XIN variants as feya (Фея)', () => {
      expect(resolveCardMachineType({ machine: 'CNC KE XIN - ФЕЯ №Ф19' })).toBe('feya')
      expect(resolveCardMachineType({ machine: 'CNC KE XIN - ФЕЯ №Ф16' })).toBe('feya')
      expect(resolveCardMachineType({ machine: 'ФЕЯ №Ф1' })).toBe('feya')
    })

    it('classifies Dragon variants as drakon (Дракон)', () => {
      expect(resolveCardMachineType({ machine: 'CNC 6000×2000 - 4 - 96 листів (Дракон)' })).toBe('drakon')
      expect(resolveCardMachineType({ machine: 'CNC 60x20 №D1' })).toBe('drakon')
    })

    it('classifies 3050 variants as shvydkisnyi (Швидкісний)', () => {
      expect(resolveCardMachineType({ machine: 'CNC 3050(16)x16 - 3-12 листів (швидкісний)' })).toBe('shvydkisnyi')
      expect(resolveCardMachineType({ machine: 'CNC 3050 №2' })).toBe('shvydkisnyi')
    })

    it('classifies 3060 variants as tryholovyi (Триголовий)', () => {
      expect(resolveCardMachineType({ machine: 'CNC 3060х1600 - 3-36 листів (Три Головий)' })).toBe('tryholovyi')
      expect(resolveCardMachineType({ machine: 'Триголовий №1' })).toBe('tryholovyi')
    })

    it('resolves machine type via machines dictionary lookup', () => {
      const machinesList = [
        { id: 'm-1', name: 'Верстат 1', type: 'CNC 1200x800 - 4 листи (Малий)' },
        { id: 'm-2', name: 'Верстат 2', type: 'CNC KE XIN - 4 - 16 листів (ФЕЯ)' }
      ]
      expect(resolveCardMachineType({ machine_id: 'm-1' }, machinesList)).toBe('malyi')
      expect(resolveCardMachineType({ machine_id: 'm-2' }, machinesList)).toBe('feya')
    })

    it('falls back to other for unknown machines', () => {
      expect(resolveCardMachineType({ machine: 'Невідомий верстат' })).toBe('other')
      expect(resolveCardMachineType(null)).toBe('other')
    })

    it('contains all 5 canonical machine type categories', () => {
      expect(MACHINE_TYPE_CATEGORIES.map(c => c.id)).toEqual([
        'malyi',
        'feya',
        'shvydkisnyi',
        'tryholovyi',
        'drakon'
      ])
      expect(MACHINE_TYPE_CATEGORIES.map(c => c.label)).toEqual([
        'Малий',
        'Фея',
        'Швидкісний',
        'Триголовий',
        'Дракон'
      ])
    })
  })

  describe('matchesInspectionTier helper', () => {
    it('correctly matches uninspected tier', () => {
      expect(matchesInspectionTier({ hasAnyStamp: false }, 'uninspected')).toBe(true)
      expect(matchesInspectionTier({ hasAnyStamp: true }, 'uninspected')).toBe(false)
    })

    it('correctly matches needs_recheck tier (urgent_recheck or needs_recheck)', () => {
      expect(matchesInspectionTier({ inspectionTier: 'needs_recheck' }, 'needs_recheck')).toBe(true)
      expect(matchesInspectionTier({ inspectionTier: 'urgent_recheck' }, 'needs_recheck')).toBe(true)
      expect(matchesInspectionTier({ inspectionTier: 'fresh' }, 'needs_recheck')).toBe(false)
      expect(matchesInspectionTier({ inspectionTier: 'uninspected' }, 'needs_recheck')).toBe(false)
    })

    it('correctly matches inspected / fresh tier', () => {
      expect(matchesInspectionTier({ inspectionTier: 'fresh' }, 'inspected')).toBe(true)
      expect(matchesInspectionTier({ inspectionTier: 'needs_recheck' }, 'inspected')).toBe(false)
    })

    it('matches all tiers when filterTier is all', () => {
      expect(matchesInspectionTier({ inspectionTier: 'fresh' }, 'all')).toBe(true)
      expect(matchesInspectionTier({ hasAnyStamp: false }, 'all')).toBe(true)
    })
  })

  describe('countCardsByMachineType and stage-scoped machine badge counts', () => {
    const mockCuttingCards = [
      // 18 cards on malyi (10 needs_recheck, 4 uninspected, 4 fresh)
      ...Array.from({ length: 10 }, (_, i) => ({ id: `m-recheck-${i}`, machineTypeId: 'malyi', hasAnyStamp: true, inspectionTier: 'needs_recheck' })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `m-uninspected-${i}`, machineTypeId: 'malyi', hasAnyStamp: false, inspectionTier: 'uninspected' })),
      ...Array.from({ length: 4 }, (_, i) => ({ id: `m-fresh-${i}`, machineTypeId: 'malyi', hasAnyStamp: true, inspectionTier: 'fresh' })),

      // 11 cards on feya (11 needs_recheck, 0 uninspected, 0 fresh)
      ...Array.from({ length: 11 }, (_, i) => ({ id: `f-recheck-${i}`, machineTypeId: 'feya', hasAnyStamp: true, inspectionTier: 'needs_recheck' }))
    ]

    it('counts all 29 cards across machine types when on all stage', () => {
      const allCounts = countCardsByMachineType(mockCuttingCards)
      expect(allCounts.all).toBe(29)
      expect(allCounts.malyi).toBe(18)
      expect(allCounts.feya).toBe(11)
      expect(allCounts.shvydkisnyi).toBe(0)
    })

    it('scopes machine type badge counts only to cards in needs_recheck stage (21 total: 10 malyi, 11 feya)', () => {
      const needsRecheckCards = mockCuttingCards.filter(c => matchesInspectionTier(c, 'needs_recheck'))
      const stageCounts = countCardsByMachineType(needsRecheckCards)

      expect(stageCounts.all).toBe(21)
      expect(stageCounts.malyi).toBe(10)
      expect(stageCounts.feya).toBe(11)
      expect(stageCounts.shvydkisnyi).toBe(0)
      expect(stageCounts.tryholovyi).toBe(0)
      expect(stageCounts.drakon).toBe(0)
    })

    it('scopes machine type badge counts only to cards in uninspected stage (4 total: 4 malyi, 0 feya)', () => {
      const uninspectedCards = mockCuttingCards.filter(c => matchesInspectionTier(c, 'uninspected'))
      const stageCounts = countCardsByMachineType(uninspectedCards)

      expect(stageCounts.all).toBe(4)
      expect(stageCounts.malyi).toBe(4)
      expect(stageCounts.feya).toBe(0)
    })
  })
})

