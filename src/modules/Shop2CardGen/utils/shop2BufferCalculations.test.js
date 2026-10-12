import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildShop2ScrapByCard,
  buildShop2UtilRows,
  resolveShop2CardScrap,
  isRerunOrder,
  getParentOrderNum,
  buildRerunToParentOrderMap
} from './shop2BufferCalculations.js'

test('aggregates painting scrap history by work card', () => {
  const totals = buildShop2ScrapByCard([
    { card_id: 'card-1', stage_name: 'Фарбування', scrap_qty: 500 },
    { card_id: 'card-1', stage_name: 'Фарбування', scrap_qty: 200 },
    { card_id: 'card-2', stage_name: 'Пресування', scrap_qty: 10 }
  ])

  assert.equal(totals.get('card-1'), 700)
  assert.equal(totals.get('card-2'), 10)
})

test('uses history scrap when the work card itself has no scrap field', () => {
  const totals = buildShop2ScrapByCard([{ card_id: 'card-1', scrap_qty: 700 }])
  assert.equal(resolveShop2CardScrap({ id: 'card-1', scrap_qty: 0 }, totals), 700)
})

test('does not double count scrap stored on both card and history', () => {
  const totals = buildShop2ScrapByCard([{ card_id: 'card-1', scrap_qty: 700 }])
  assert.equal(resolveShop2CardScrap({ id: 'card-1', scrap_qty: 700 }, totals), 700)
})

test('creates a separate final-util row for each concrete order and part', () => {
  const rows = buildShop2UtilRows([{
    nomId: 'part-1',
    nomName: 'Деталь 1',
    shop2UtilQty: 300,
    ordersList: [
      { orderId: 'order-1', orderNum: '261001-5', shop2UtilQty: 100 },
      { orderId: 'order-2', orderNum: '261002-1', shop2UtilQty: 200 }
    ]
  }])

  assert.deepEqual(rows.map(row => [row.orderId, row.shop2UtilQty]), [
    ['order-1', 100],
    ['order-2', 200]
  ])
})

test('unclassified shop 2 scrap is not treated as final util', () => {
  const rows = buildShop2UtilRows([{
    nomId: 'part-1',
    shop2ScrapQty: 700,
    shop2UtilQty: 0,
    ordersList: [{ orderId: 'order-1', shop2ScrapQty: 700, shop2UtilQty: 0 }]
  }])

  assert.deepEqual(rows, [])
})

test('correctly identifies rerun child orders and parent order numbers', () => {
  assert.equal(isRerunOrder({ order_num: '261001-5' }), false)
  assert.equal(isRerunOrder({ order_num: '261001-5-Д1' }), true)
  assert.equal(isRerunOrder({ order_num: '261001-5-Д2' }), true)
  assert.equal(isRerunOrder({ order_num: 'TEST', customer: 'Замовник (Довипуск)' }), true)

  assert.equal(getParentOrderNum({ order_num: '261001-5-Д1' }), '261001-5')
  assert.equal(getParentOrderNum({ order_num: '261001-5' }), '261001-5')
  assert.equal(getParentOrderNum({ order_num: 'RERUN', accessories: 'Довипуск. Батьківський наряд: 261001-5' }), '261001-5')
})

test('builds accurate rerun-to-parent order ID mapping', () => {
  const orders = [
    { id: 'parent-id', order_num: '261001-5' },
    { id: 'rerun-1-id', order_num: '261001-5-Д1' },
    { id: 'rerun-2-id', order_num: '261001-5-Д2' },
    { id: 'other-id', order_num: '261002-1' }
  ]

  const map = buildRerunToParentOrderMap(orders)
  assert.equal(map.get('rerun-1-id'), 'parent-id')
  assert.equal(map.get('rerun-2-id'), 'parent-id')
  assert.equal(map.has('parent-id'), false)
  assert.equal(map.has('other-id'), false)
})

test('active rerun quantity offsets util deficit so already re-issued scrap is not duplicated', () => {
  const rows = buildShop2UtilRows([{
    nomId: 'part-1',
    nomName: 'F415-ІП27-П-10-38',
    ordersList: [
      { orderId: 'order-1', orderNum: '261001-5', shop2UtilQty: 700, activeRerunQty: 700 },
      { orderId: 'order-2', orderNum: '261002-1', shop2UtilQty: 300, activeRerunQty: 100 }
    ]
  }])

  // order-1 is fully covered (700 util - 700 rerun = 0 deficit)
  // order-2 has 300 - 100 = 200 remaining deficit
  assert.deepEqual(rows.map(row => [row.orderId, row.shop2UtilQty]), [
    ['order-2', 200]
  ])
})

test('identifies SGP / Packaging operations correctly for direct transfer', async () => {
  const { isPackagingOperation } = await import('../constants/shop2Stages.js')
  assert.equal(isPackagingOperation('Склад СГП (пряма передача)'), true)
  assert.equal(isPackagingOperation('Склад СГП'), true)
  assert.equal(isPackagingOperation('Пакування/СГП'), true)
  assert.equal(isPackagingOperation('Пакування'), true)
  assert.equal(isPackagingOperation('Фарбування'), false)
  assert.equal(isPackagingOperation('Пресування'), false)
  assert.equal(isPackagingOperation('Доопрацювання'), false)
})


