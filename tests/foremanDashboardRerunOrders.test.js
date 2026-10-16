import { describe, expect, it } from 'vitest'
import {
  filterCommercialDashboardTasks,
  isTechnicalRerunTask,
} from '../src/modules/ForemanDashboard/utils/foremanDashboardOrderScope.js'

describe('foreman dashboard technical rerun orders', () => {
  const ordersMap = {
    parent: { id: 'parent', order_num: '261001-5', customer: 'FT' },
    secondParent: { id: 'secondParent', order_num: '261015-1', customer: 'FT' },
    d1: { id: 'd1', order_num: '261001-5-Д1', customer: 'FT' },
    d2: { id: 'd2', order_num: '261001-5-д2', customer: 'FT' },
    d5: { id: 'd5', order_num: '261001-5-Д5', customer: 'FT' },
  }

  it.each(['d1', 'd2', 'd5'])('recognizes %s as a technical rerun', orderId => {
    expect(isTechnicalRerunTask({ order_id: orderId }, ordersMap)).toBe(true)
  })

  it('keeps only commercial orders in dashboard scope', () => {
    const tasks = [
      { id: 'parent-task', order_id: 'parent', planned_sets: 3500 },
      { id: 'd1-task', order_id: 'd1', planned_sets: 350 },
      { id: 'd2-task', order_id: 'd2', planned_sets: 350 },
      { id: 'd5-task', order_id: 'd5', planned_sets: 350 },
    ]

    expect(filterCommercialDashboardTasks(tasks, ordersMap)).toEqual([tasks[0]])
  })

  it('does not inflate aggregate demand with rerun planned sets', () => {
    const tasks = [
      { id: 'parent-task', order_id: 'parent', planned_sets: 3500 },
      { id: 'second-parent-task', order_id: 'secondParent', planned_sets: 3500 },
      { id: 'rerun-task', order_id: 'd1', planned_sets: 700 },
    ]
    const commercialSets = filterCommercialDashboardTasks(tasks, ordersMap)
      .reduce((sum, task) => sum + task.planned_sets, 0)

    expect(commercialSets * 4).toBe(28000)
    expect(commercialSets * 2).toBe(14000)
  })
})
