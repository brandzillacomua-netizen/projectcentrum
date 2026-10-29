import { describe, expect, it } from 'vitest'
import { isCardInCutting, getActiveCuttingCards } from '../src/modules/Brak/components/modals/BrakActiveCuttingModal.jsx'

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
})

