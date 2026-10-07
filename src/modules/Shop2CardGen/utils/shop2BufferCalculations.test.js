import test from 'node:test'
import assert from 'node:assert/strict'
import { buildShop2ScrapByCard, buildShop2UtilRows, resolveShop2CardScrap } from './shop2BufferCalculations.js'

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
