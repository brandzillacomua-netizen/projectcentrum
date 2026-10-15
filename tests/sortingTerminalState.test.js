import { describe, expect, it } from 'vitest'
import {
  applySortingCompletionToCards,
  canCompleteSortingCard
} from '../src/modules/Sorting/utils/sortingTerminalState.js'

describe('Sorting terminal completion state', () => {
  it('immediately makes a completed card ineligible for another submission', () => {
    const cards = [{
      id: 'card-1',
      status: 'in-progress',
      operation: 'Сортування',
      quantity: 56
    }]

    expect(canCompleteSortingCard(cards[0])).toBe(true)

    const updated = applySortingCompletionToCards(cards, {
      cardId: 'card-1',
      goodQty: 56,
      reworkQty: 0,
      completedAt: '2026-10-15T08:00:00.000Z'
    })

    expect(updated[0]).toMatchObject({
      status: 'at-shop2-buffer',
      operation: 'Сортування',
      quantity: 56,
      used_in_shop2_qty: 0,
      completed_at: '2026-10-15T08:00:00.000Z'
    })
    expect(canCompleteSortingCard(updated[0])).toBe(false)
  })

  it('does not alter other cards', () => {
    const cards = [
      { id: 'card-1', status: 'in-progress', operation: 'Сортування', quantity: 56 },
      { id: 'card-2', status: 'in-progress', operation: 'Сортування', quantity: 84 }
    ]

    const updated = applySortingCompletionToCards(cards, {
      cardId: 'card-1',
      goodQty: 50,
      reworkQty: 4
    })

    expect(updated[1]).toEqual(cards[1])
    expect(updated[0].quantity).toBe(54)
  })
})
