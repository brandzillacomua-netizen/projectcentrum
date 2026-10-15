import { describe, expect, it } from 'vitest'
import {
  buildPackagingOrderScope,
  getPackagingOrderContext,
  getParentPackagingPlan,
  isOrderInPackagingScope
} from '../src/modules/Packaging/utils/packagingOrderScope.js'

describe('packaging rerun order scope', () => {
  const orders = [
    { id: 'parent-id', order_num: '261001-5', customer: 'FT' },
    { id: 'rerun-id', order_num: '261001-5-Д1', customer: 'FT (Довипуск)' },
    { id: 'other-id', order_num: '261008-1', customer: 'Other' }
  ]

  it('folds a technical rerun into the parent packaging document', () => {
    const scope = buildPackagingOrderScope(orders)
    const context = getPackagingOrderContext('rerun-id', scope)

    expect(context.parentOrderId).toBe('parent-id')
    expect(context.parentOrder.order_num).toBe('261001-5')
    expect(context.scopeOrderIds).toEqual(expect.arrayContaining(['parent-id', 'rerun-id']))
    expect(isOrderInPackagingScope('rerun-id', context.scopeOrderIds)).toBe(true)
    expect(isOrderInPackagingScope('other-id', context.scopeOrderIds)).toBe(false)
  })

  it('keeps the commercial parent plan instead of adding the rerun quantity', () => {
    const tasks = [
      { id: 'parent-task', order_id: 'parent-id', planned_sets: 3500 },
      { id: 'rerun-task', order_id: 'rerun-id', planned_sets: 700 }
    ]

    expect(getParentPackagingPlan(tasks, 'parent-id', '', tasks[1])).toBe(3500)
  })

  it('does not turn an orphan rerun quantity into a new packaging plan', () => {
    const rerunTask = { id: 'rerun-task', order_id: 'rerun-id', planned_sets: 700 }
    expect(getParentPackagingPlan([rerunTask], 'parent-id', '', rerunTask)).toBe(0)
  })
})
