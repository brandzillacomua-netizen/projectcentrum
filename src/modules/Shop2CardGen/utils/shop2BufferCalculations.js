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

export const buildShop2UtilRows = (bufferRows = []) => {
  const rows = []

  ;(bufferRows || []).forEach(row => {
    const orderUtilRows = (row?.ordersList || [])
      .filter(order => asQty(order?.shop2UtilQty) > 0)
      .map(order => ({
        ...row,
        key: `${row.nomId}_${order.orderId || 'no-order'}_shop2-util`,
        orderId: order.orderId || 'no-order',
        orderNum: order.orderNum || 'Без наряду',
        customer: order.customer || '—',
        productName: order.productName || row.productFamily || '—',
        shop2UtilQty: asQty(order.shop2UtilQty),
        ordersList: [order]
      }))

    if (orderUtilRows.length > 0) {
      rows.push(...orderUtilRows)
      return
    }

    const utilQty = asQty(row?.shop2UtilQty)
    if (utilQty <= 0) return
    rows.push({
      ...row,
      key: `${row.nomId}_${row.orderId || 'no-order'}_shop2-util`,
      orderId: row.orderId || 'no-order',
      orderNum: 'Без наряду',
      customer: '—',
      productName: row.productFamily || '—',
      shop2UtilQty: utilQty
    })
  })

  return rows
}
