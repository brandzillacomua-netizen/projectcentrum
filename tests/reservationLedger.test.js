import { describe, expect, it } from 'vitest'
import {
  requestBelongsToOpenWork,
  selectIssuedRequestsForInventory,
  sumRequestQuantity
} from '../src/services/reservationLedger.js'

describe('inventory reservation ledger', () => {
  const requests = [
    { id: 'exact-issued', inventory_id: 'stock-a', nomenclature_id: 'nom-1', status: 'issued', quantity: 12, task_id: 'task-open' },
    { id: 'other-stock', inventory_id: 'stock-b', nomenclature_id: 'nom-1', status: 'issued', quantity: 50, task_id: 'task-open' },
    { id: 'nom-only', inventory_id: null, nomenclature_id: 'nom-1', status: 'issued', quantity: 70, task_id: 'task-open' },
    { id: 'pending', inventory_id: 'stock-a', nomenclature_id: 'nom-1', status: 'pending', quantity: 30, task_id: 'task-open' },
    { id: 'completed-task', inventory_id: 'stock-a', nomenclature_id: 'nom-1', status: 'issued', quantity: 8, task_id: 'task-done' }
  ]

  it('counts only issued requests bound to the exact physical stock row', () => {
    const actual = selectIssuedRequestsForInventory(
      requests,
      'stock-a',
      [{ id: 'task-open', status: 'in-progress' }, { id: 'task-done', status: 'completed' }]
    )

    expect(actual.map(request => request.id)).toEqual(['exact-issued'])
    expect(sumRequestQuantity(actual)).toBe(12)
  })

  it('does not treat same-nomenclature or pending requests as current reserve', () => {
    const actual = selectIssuedRequestsForInventory(requests, 'stock-a')
    expect(actual.map(request => request.id)).toEqual(['exact-issued', 'completed-task'])
    expect(sumRequestQuantity(actual)).toBe(20)
  })

  it('recognizes terminal tasks and orders as stale ledger rows', () => {
    expect(requestBelongsToOpenWork(
      { task_id: 'task-1' },
      [{ id: 'task-1', status: 'cancelled' }]
    )).toBe(false)
    expect(requestBelongsToOpenWork(
      { order_id: 'order-1' },
      [],
      [{ id: 'order-1', status: 'shipped' }]
    )).toBe(false)
  })
})
