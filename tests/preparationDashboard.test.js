import { describe, it, expect } from 'vitest'
import {
  computeSheetOrders,
  computeBoxOrders,
  computePreparationTotals,
  computePreparationAlerts
} from '../src/modules/Preparation/hooks/usePreparationDashboardData.js'

describe('Preparation TV Dashboard Calculations', () => {
  const orderById = new Map([
    ['ord-101', { id: 'ord-101', order_num: '241026-1', status: 'in-progress' }],
    ['ord-102', { id: 'ord-102', order_num: '241026-2', status: 'in-progress' }]
  ])

  const nomenclatures = [
    { id: 'nom-sheet-1', name: 'Карбон Т700 2.0мм (500х600)', type: 'sheet' },
    { id: 'nom-sheet-2', name: 'Карбон Т300 1.5мм (500х600)', type: 'sheet' },
    { id: 'nom-part-1', name: 'Промінь 2.0', material_type: 'Карбон Т700 2.0мм' },
    { id: 'nom-part-2', name: 'Пластина 1.5', material_type: 'Карбон Т300 1.5мм' },
    { id: 'nom-cut-1', name: 'Фреза D2.0 компресійна', type: 'consumable' }
  ]

  const cardsWithBoxes = [
    // Order 101, Card 1: 2 sheets, issued, box prepared
    {
      card: { id: 'wc-1', order_id: 'ord-101', card_info: '1/2 [BOX_ISSUED:true] [BOX_PREPARED:true] [SHEET_ISSUED:true]', sheet_issued: true },
      nom: nomenclatures[2],
      activeMaterialName: 'Карбон Т700 2.0мм',
      cardSheets: 2,
      isIssued: true,
      sheetIssued: true,
      isPrepared: true,
      cutters: [{ nomenclature_id: 'nom-cut-1', name: 'Фреза D2.0 компресійна', qty: 2 }]
    },
    // Order 101, Card 2: 3 sheets, NOT issued, box NOT prepared
    {
      card: { id: 'wc-2', order_id: 'ord-101', card_info: '2/2' },
      nom: nomenclatures[2],
      activeMaterialName: 'Карбон Т700 2.0мм',
      cardSheets: 3,
      isIssued: false,
      isPrepared: false,
      cutters: [{ nomenclature_id: 'nom-cut-1', name: 'Фреза D2.0 компресійна', qty: 3 }]
    },
    // Order 102, Card 3: 4 sheets, NOT issued, box NOT prepared
    {
      card: { id: 'wc-3', order_id: 'ord-102', card_info: '1/1' },
      nom: nomenclatures[3],
      activeMaterialName: 'Карбон Т300 1.5мм',
      cardSheets: 4,
      isIssued: false,
      isPrepared: false,
      cutters: [{ nomenclature_id: 'nom-cut-1', name: 'Фреза D2.0 компресійна', qty: 1 }]
    }
  ]

  it('aggregates sheet issuance status per order from warehouse (СО)', () => {
    const sheetOrders = computeSheetOrders({
      cardsWithBoxes,
      requests: [],
      nomenclatures,
      orderById
    })

    expect(sheetOrders).toHaveLength(2)

    // Order 102 (deficit 4) should sort before Order 101 (deficit 3) because it has more pending sheets
    const order102 = sheetOrders.find(o => o.orderNum === '241026-2')
    expect(order102).toBeDefined()
    expect(order102.totalSheets).toBe(4)
    expect(order102.issuedSheets).toBe(0)
    expect(order102.pendingSheets).toBe(4)
    expect(order102.percent).toBe(0)
    expect(order102.status).toBe('waiting')

    const order101 = sheetOrders.find(o => o.orderNum === '241026-1')
    expect(order101).toBeDefined()
    expect(order101.totalSheets).toBe(5)
    expect(order101.issuedSheets).toBe(2)
    expect(order101.pendingSheets).toBe(3)
    expect(order101.percent).toBe(40)
    expect(order101.status).toBe('partial')

    // Material breakdown
    expect(order101.materials).toHaveLength(1)
    expect(order101.materials[0].name).toBe('Карбон Т700 2.0мм')
    expect(order101.materials[0].needed).toBe(5)
    expect(order101.materials[0].issued).toBe(2)
    expect(order101.materials[0].pending).toBe(3)
  })

  it('computes box assembly progress and cutters required inside boxes', () => {
    const boxOrders = computeBoxOrders({
      cardsWithBoxes,
      orderById
    })

    expect(boxOrders).toHaveLength(2)

    const boxOrder101 = boxOrders.find(o => o.orderNum === '241026-1')
    expect(boxOrder101).toBeDefined()
    expect(boxOrder101.total).toBe(2)
    expect(boxOrder101.prepared).toBe(1)
    expect(boxOrder101.pending).toBe(1)
    expect(boxOrder101.percent).toBe(50)

    // Cutters tooling inside boxes
    expect(boxOrder101.cutters).toHaveLength(1)
    expect(boxOrder101.cutters[0].name).toBe('Фреза D2.0 компресійна')
    expect(boxOrder101.cutters[0].qty).toBe(5) // 2 + 3

    // Individual box cards
    expect(boxOrder101.boxes).toHaveLength(2)
    expect(boxOrder101.boxes[0].seq).toBe('1/2')
    expect(boxOrder101.boxes[0].isPrepared).toBe(true)
    expect(boxOrder101.boxes[1].seq).toBe('2/2')
    expect(boxOrder101.boxes[1].isPrepared).toBe(false)
  })

  it('calculates global KPIs totals and alerts', () => {
    const sheetOrders = computeSheetOrders({ cardsWithBoxes, requests: [], nomenclatures, orderById })
    const boxOrders = computeBoxOrders({ cardsWithBoxes, orderById })
    const prepQueue = []

    const totals = computePreparationTotals({ sheetOrders, boxOrders, prepQueue })
    expect(totals.sheetsTotal).toBe(9) // 5 + 4
    expect(totals.sheetsIssued).toBe(2)
    expect(totals.sheetsPending).toBe(7)
    expect(totals.sheetsPercent).toBe(22) // 2/9 = 22%

    expect(totals.boxesTotal).toBe(3) // 2 + 1
    expect(totals.boxesPrepared).toBe(1)
    expect(totals.boxesPending).toBe(2)
    expect(totals.boxesPercent).toBe(33) // 1/3 = 33%

    const alerts = computePreparationAlerts({
      activeSheetOrders: sheetOrders,
      activeBoxOrders: boxOrders,
      prepQueue,
      now: new Date()
    })

    expect(alerts.length).toBeGreaterThan(0)
    expect(alerts.some(a => a.text.includes('241026-1') && a.text.includes('дефіцит'))).toBe(true)
  })

  it('filters out cutters from sheet requests and does not treat box issuance as sheet issuance', () => {
    const orderRequests = [
      // Real sheet request for order 241026-2
      {
        id: 'req-1',
        order_id: 'ord-102',
        nomenclature_id: 'nom-sheet-2',
        quantity: 10,
        status: 'pending',
        category: 'sheet',
        details: 'СКЛАД ОПЕРАТИВНИЙ: Лист Т300 1.5мм — 10 л.'
      },
      // Cutter request that happens to mention sheet in details
      {
        id: 'req-2',
        order_id: 'ord-102',
        nomenclature_id: 'nom-cut-1',
        quantity: 5,
        status: 'completed',
        category: 'cutter',
        details: 'СКЛАД ОПЕРАТИВНИЙ (ВИТРАТНІ МАТЕРІАЛИ): Фреза D2.0 компресійна — 5 шт. (Лист Т300 1.5мм)'
      }
    ]

    const cardOnlyBoxIssued = [
      {
        card: { id: 'wc-10', order_id: 'ord-102', card_info: '1/1 [BOX_ISSUED:true]', is_box_issued: true },
        nom: nomenclatures[3],
        activeMaterialName: 'Карбон Т300 1.5мм',
        cardSheets: 4,
        isIssued: true, // From warehouse box tab
        isPrepared: true
      }
    ]

    const sheetOrders = computeSheetOrders({
      cardsWithBoxes: cardOnlyBoxIssued,
      requests: orderRequests,
      nomenclatures,
      orderById,
      tasks: [{ id: 'task-1', order_id: 'ord-102', warehouse_conf: 'false' }]
    })

    const order = sheetOrders.find(o => o.orderNum === '241026-2')
    expect(order).toBeDefined()
    // Cutter request must NOT be included in sheets!
    expect(order.materials.some(m => m.name.includes('Фреза'))).toBe(false)
    // Box issuance does NOT make sheets issued!
    expect(order.issuedSheets).toBe(0)
    expect(order.pendingSheets).toBe(4)
  })
})
