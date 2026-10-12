const asQty = value => Math.max(0, Number(value) || 0)

export const buildShop2ScrapByCard = (historyRows = []) => {
  const totals = new Map()
  ;(historyRows || []).forEach(row => {
    const cardId = row?.card_id
    const scrapQty = asQty(row?.scrap_qty)
    if (!cardId || scrapQty <= 0) return
    const key = String(cardId)
    totals.set(key, (totals.get(key) || 0) + scrapQty)
  })
  return totals
}

export const resolveShop2CardScrap = (card, historyScrapByCard = new Map()) => {
  if (!card) return 0
  const cardScrap = asQty(card.scrap_qty)
  const historyScrap = asQty(historyScrapByCard.get(String(card.id)))

  // Some workflows persist the same cumulative scrap both on the card and in
  // history. Taking the larger source exposes painting/pressing history without
  // counting the same loss twice.
  return Math.max(cardScrap, historyScrap)
}

export const isRerunOrder = (order) => {
  if (!order) return false
  const num = String(order.order_num || '')
  if (/-Д\d+$/i.test(num) || num.includes('-Д')) return true
  const cust = String(order.customer || '')
  if (cust.toLowerCase().includes('довипуск')) return true
  const acc = String(order.accessories || '')
  if (acc.toLowerCase().includes('довипуск')) return true
  return false
}

export const getParentOrderNum = (order) => {
  if (!order) return ''
  const num = String(order.order_num || '').trim()
  if (num.includes('-Д')) {
    return num.split('-Д')[0].trim()
  }
  const acc = String(order.accessories || '')
  const match = acc.match(/Батьківський наряд:\s*([^\s,;]+)/i)
  if (match) return match[1].trim()
  return num
}

export const buildRerunToParentOrderMap = (orders = []) => {
  const map = new Map()
  const ordersByNum = new Map()
  ;(orders || []).forEach(o => {
    if (o?.order_num) {
      ordersByNum.set(String(o.order_num).trim(), String(o.id))
    }
  })

  ;(orders || []).forEach(o => {
    if (isRerunOrder(o)) {
      const parentNum = getParentOrderNum(o)
      if (parentNum && ordersByNum.has(parentNum)) {
        map.set(String(o.id), ordersByNum.get(parentNum))
      }
    }
  })

  return map
}

export const buildShop2UtilRows = (bufferRows = []) => {
  const rows = []

  ;(bufferRows || []).forEach(row => {
    const orderUtilRows = (row?.ordersList || [])
      .filter(order => asQty(order?.shop2UtilQty) > 0)
      .map(order => {
        const unrequestedDeficit = Math.max(0, asQty(order.shop2UtilQty) - asQty(order.activeRerunQty))
        if (unrequestedDeficit <= 0) return null
        return {
          ...row,
          key: `${row.nomId}_${order.orderId || 'no-order'}_shop2-util`,
          orderId: order.orderId || 'no-order',
          orderNum: order.orderNum || 'Без наряду',
          customer: order.customer || '—',
          productName: order.productName || row.productFamily || '—',
          shop2UtilQty: unrequestedDeficit,
          ordersList: [{ ...order, shop2UtilQty: unrequestedDeficit }]
        }
      })
      .filter(Boolean)

    if (orderUtilRows.length > 0) {
      rows.push(...orderUtilRows)
      return
    }

    const unrequestedDeficit = Math.max(0, asQty(row?.shop2UtilQty) - asQty(row?.activeRerunQty))
    if (unrequestedDeficit <= 0) return
    rows.push({
      ...row,
      key: `${row.nomId}_${row.orderId || 'no-order'}_shop2-util`,
      orderId: row.orderId || 'no-order',
      orderNum: 'Без наряду',
      customer: '—',
      productName: row.productFamily || '—',
      shop2UtilQty: unrequestedDeficit
    })
  })

  return rows
}

