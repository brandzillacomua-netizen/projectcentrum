import { describe, it, expect, vi } from 'vitest'
import { createProductionOrdersActions } from '../src/contexts/production/productionOrders.js'
import { isShop2WorkCard } from '../src/modules/Shop2CardGen/hooks/useShop2BufferData.js'

describe('Shop 2 Buffer & Early Packaging Workflow Transition', () => {
  it('identifies Shop 2 work cards by operation or tag without requiring a Shop 2 task', () => {
    const emptyTaskSet = new Set()

    const cardWithTag = {
      id: 'c-1',
      operation: 'Пресування',
      card_info: '[ЦЕХ №2] Деталь 1'
    }
    expect(isShop2WorkCard(cardWithTag, emptyTaskSet)).toBe(true)

    const cardWithShopTag = {
      id: 'c-2',
      operation: 'Фарбування',
      card_info: '[SHOP:2] Деталь 2'
    }
    expect(isShop2WorkCard(cardWithShopTag, emptyTaskSet)).toBe(true)

    const cardCutting = {
      id: 'c-3',
      operation: 'Розкрій',
      card_info: 'Наряд №123'
    }
    expect(isShop2WorkCard(cardCutting, emptyTaskSet)).toBe(false)
  })

  it('correctly calculates order production progress when order has Shop 2 buffer cards without a Shop 2 task', () => {
    const orderId = 'a1111111-2222-3333-4444-555555555555'
    const order = {
      id: orderId,
      order_num: 'ORD-100',
      status: 'in-progress',
      order_items: [{ id: 'item-1', quantity: 10 }]
    }

    const tasks = [
      {
        id: 'task-cut',
        order_id: orderId,
        step: 'Розкрій',
        status: 'completed',
        planned_sets: 10
      },
      {
        id: 'task-pack',
        order_id: orderId,
        step: 'Пакування',
        status: 'in-progress',
        planned_sets: 10
      }
    ]

    // Scenario A: Cards are in Shop 2 buffer -> status must be 'shop2'
    const workCardsInBuffer = [
      {
        id: 'card-buf-1',
        order_id: orderId,
        status: 'at-shop2-buffer',
        quantity: 10
      }
    ]

    const depsA = {
      orders: [order],
      tasks,
      inventory: [],
      nomenclatures: [],
      bomItems: [],
      workCards: workCardsInBuffer,
      machineOperations: [],
      machines: [],
      systemUsers: [],
      currentUser: { id: 'usr-1' },
      setTasks: vi.fn(),
      setWorkCards: vi.fn(),
      setWorkCardHistory: vi.fn(),
      setManagementTasks: vi.fn(),
      setMachines: vi.fn(),
      normalize: s => s,
      refreshTable: vi.fn(),
      fetchData: vi.fn(),
      deductIssuedMaterialsForTask: vi.fn()
    }

    const ordersActionsA = createProductionOrdersActions(depsA)
    const progressA = ordersActionsA.getOrderProductionProgress(orderId)
    expect(progressA.status).toBe('shop2')

    // Scenario B: No Shop 2 buffer cards, cutting is completed -> status must be 'packaging'
    const depsB = {
      ...depsA,
      workCards: [
        {
          id: 'card-sgp-1',
          order_id: orderId,
          status: 'completed',
          operation: 'Пакування/СГП',
          quantity: 10
        }
      ]
    }
    const ordersActionsB = createProductionOrdersActions(depsB)
    const progressB = ordersActionsB.getOrderProductionProgress(orderId)
    expect(progressB.status).toBe('packaging')
  })

  it('marks order as packaged when all packaging is completed', () => {
    const orderId = 'a1111111-2222-3333-4444-555555555555'
    const order = {
      id: orderId,
      order_num: 'ORD-100',
      status: 'in-progress',
      order_items: [{ id: 'item-1', quantity: 10 }]
    }

    const tasks = [
      {
        id: 'task-cut',
        order_id: orderId,
        step: 'Розкрій',
        status: 'completed',
        planned_sets: 10,
        plan_snapshot: { _metadata: { is_packaged: true } }
      },
      {
        id: 'task-pack',
        order_id: orderId,
        step: 'Пакування',
        status: 'completed',
        planned_sets: 10,
        plan_snapshot: { _metadata: { is_packaged: true } }
      }
    ]

    const deps = {
      orders: [order],
      tasks,
      inventory: [],
      nomenclatures: [],
      bomItems: [],
      workCards: [],
      machineOperations: [],
      machines: [],
      systemUsers: [],
      currentUser: { id: 'usr-1' },
      setTasks: vi.fn(),
      setWorkCards: vi.fn(),
      setWorkCardHistory: vi.fn(),
      setManagementTasks: vi.fn(),
      setMachines: vi.fn(),
      normalize: s => s,
      refreshTable: vi.fn(),
      fetchData: vi.fn(),
      deductIssuedMaterialsForTask: vi.fn()
    }

    const ordersActions = createProductionOrdersActions(deps)
    const progress = ordersActions.getOrderProductionProgress(orderId)
    expect(progress.status).toBe('packaged')
    expect(progress.isFullyPackaged).toBe(true)
  })
})
