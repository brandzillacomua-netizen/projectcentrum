import { describe, it, expect } from 'vitest'

describe('Packaging Task Split & Batch Logistics', () => {
  // Функція розподілу (відтворює логіку PackagingSplitModal)
  const computeFIFOAllocations = (batchSchedule, alreadyPackedCount) => {
    let remaining = Math.max(0, alreadyPackedCount)
    const res = {}
    batchSchedule.forEach(b => {
      const qty = Number(b.quantity) || 0
      const take = Math.min(remaining, qty)
      res[b.batch_num] = take
      remaining -= take
    })
    return res
  }

  it('correctly calculates FIFO allocations across manager batches', () => {
    const schedule = [
      { batch_num: 1, quantity: 100, deadline: '2026-09-12' },
      { batch_num: 2, quantity: 200, deadline: '2026-09-18' },
      { batch_num: 3, quantity: 200, deadline: '2026-09-25' }
    ]

    // Scenario: 300 pcs packed -> Batch 1 gets 100, Batch 2 gets 200, Batch 3 gets 0
    const allocations = computeFIFOAllocations(schedule, 300)
    expect(allocations[1]).toBe(100)
    expect(allocations[2]).toBe(200)
    expect(allocations[3]).toBe(0)

    // Check completion status for each batch
    expect(allocations[1] >= schedule[0].quantity).toBe(true)
    expect(allocations[2] >= schedule[1].quantity).toBe(true)
    expect(allocations[3] >= schedule[2].quantity).toBe(false)
  })

  it('supports custom manual distribution when user overrides FIFO', () => {
    const schedule = [
      { batch_num: 1, quantity: 100 },
      { batch_num: 2, quantity: 200 },
      { batch_num: 3, quantity: 200 }
    ]

    // User manually distributed 300 pcs as 80, 150, 70
    const customAllocations = { 1: 80, 2: 150, 3: 70 }
    const totalAllocated = Object.values(customAllocations).reduce((s, v) => s + v, 0)
    expect(totalAllocated).toBe(300)

    const remainingForBatch1 = Math.max(0, schedule[0].quantity - customAllocations[1])
    expect(remainingForBatch1).toBe(20)

    const remainingForBatch2 = Math.max(0, schedule[1].quantity - customAllocations[2])
    expect(remainingForBatch2).toBe(50)

    const remainingForBatch3 = Math.max(0, schedule[2].quantity - customAllocations[3])
    expect(remainingForBatch3).toBe(130)
  })

  it('ensures shipping recognizes completed split batch independently with exact planned sets', () => {
    const orderId = 'ord-split-uuid-1'
    const order = {
      id: orderId,
      order_num: '1054',
      customer: 'ТОВ Епіцентр',
      order_items: [{ id: 'it-1', quantity: 500 }]
    }

    // 3 tasks after split: Batch 1 (100 pcs, completed), Batch 2 (200 pcs, completed), Batch 3 (200 pcs, in-progress)
    const tasks = [
      {
        id: 't-1',
        order_id: orderId,
        step: 'Пакування',
        batch_index: 'П1',
        planned_sets: 100,
        status: 'completed',
        plan_snapshot: { _metadata: { is_packaged: true, batch_index: 'П1', planned_sets: 100 } }
      },
      {
        id: 't-2',
        order_id: orderId,
        step: 'Пакування',
        batch_index: 'П2',
        planned_sets: 200,
        status: 'completed',
        plan_snapshot: { _metadata: { is_packaged: true, batch_index: 'П2', planned_sets: 200 } }
      },
      {
        id: 't-3',
        order_id: orderId,
        step: 'Пакування',
        batch_index: 'П3',
        planned_sets: 200,
        status: 'in-progress',
        plan_snapshot: { _metadata: { is_packaged: false, batch_index: 'П3', planned_sets: 200 } }
      }
    ]

    // Shipping ready filter
    const allReady = tasks.filter(t =>
      t.status === 'completed' &&
      t.plan_snapshot?._metadata?.is_packaged === true &&
      t.plan_snapshot?._metadata?.is_shipped !== true
    )

    expect(allReady.length).toBe(2)
    expect(allReady.map(t => t.batch_index)).toEqual(['П1', 'П2'])

    // Verification of plannedSets calculation in useShippingData
    const calculateShippingPlannedSets = (t, taskList, ord) => {
      const taskSets = Number(t.planned_sets) || Number(t.plan_snapshot?._metadata?.planned_sets) || 0
      return (t.batch_index && taskSets > 0)
        ? taskSets
        : (
            taskList.reduce((max, cur) => Math.max(max, Number(cur.planned_sets) || Number(cur.plan_snapshot?._metadata?.planned_sets) || 0), 0) ||
            ord?.order_items?.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0) ||
            0
          )
    }

    const plannedSetsP1 = calculateShippingPlannedSets(allReady[0], [allReady[0]], order)
    expect(plannedSetsP1).toBe(100) // Must NOT be 500!

    const plannedSetsP2 = calculateShippingPlannedSets(allReady[1], [allReady[1]], order)
    expect(plannedSetsP2).toBe(200) // Must NOT be 500!
  })
})
