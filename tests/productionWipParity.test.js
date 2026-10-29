import { describe, expect, it } from 'vitest'
import {
  getShop2BufferRemaining,
  getUnassignedLiveSortingCards,
  getUnassignedShop2BufferCards,
  isLiveSortingCard,
  mergeCardsPreferLive
} from '../src/utils/productionWipParity.js'

describe('production WIP parity', () => {
  it('counts only the same sorting statuses as the Shop 1 monitor', () => {
    const cards = [
      { operation: 'Сортування', status: 'in-progress', quantity: 100 },
      { operation: 'Сортування', status: 'at-buffer', quantity: 200 },
      { operation: 'Сортування', status: 'new', quantity: 392 },
      { operation: 'Сортування', status: 'paused', quantity: 10 }
    ]

    expect(cards.filter(isLiveSortingCard).reduce((sum, card) => sum + card.quantity, 0)).toBe(300)
  })

  it('subtracts quantities already allocated from the Shop 2 buffer', () => {
    expect(getShop2BufferRemaining({
      status: 'at-shop2-buffer',
      quantity: 100,
      used_in_shop2_qty: 10
    })).toBe(90)
  })

  it('never lets a stale background snapshot overwrite the live card', () => {
    const merged = mergeCardsPreferLive(
      [{ id: 'card-1', status: 'at-shop2-buffer', quantity: 100, used_in_shop2_qty: 10 }],
      [{ id: 'card-1', status: 'at-shop2-buffer', quantity: 100, used_in_shop2_qty: 0 }]
    )

    expect(getShop2BufferRemaining(merged[0])).toBe(90)
  })

  it('keeps buffer cards outside visible orders in the global dashboard total', () => {
    const cards = [
      { id: 'assigned', status: 'at-shop2-buffer', quantity: 3251, used_in_shop2_qty: 0 },
      { id: 'outside-visible-orders', status: 'at-shop2-buffer', quantity: 4, used_in_shop2_qty: 0 }
    ]
    const assignedIds = new Set(['assigned'])
    const unassigned = getUnassignedShop2BufferCards(cards, assignedIds)

    expect(unassigned).toHaveLength(1)
    expect(unassigned.reduce((sum, card) => sum + getShop2BufferRemaining(card), 0)).toBe(4)
  })

  it('keeps live sorting cards outside visible orders in the global dashboard total', () => {
    const cards = [
      { id: 'assigned-sort', operation: 'Сортування', status: 'at-buffer', quantity: 14625 },
      { id: 'outside-sort', operation: 'Сортування', status: 'at-buffer', quantity: 756 }
    ]
    const assignedIds = new Set(['assigned-sort'])
    const unassigned = getUnassignedLiveSortingCards(cards, assignedIds)

    expect(unassigned).toHaveLength(1)
    expect(unassigned.reduce((sum, card) => sum + card.quantity, 0)).toBe(756)
  })
})
