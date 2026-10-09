export const getForemanTaskScopeKey = (task) => (
  `${String(task?.order_id || 'no_order')}::${String(task?.batch_index ?? 0)}`
)

const getNeedMarkerQuantity = (card) => {
  const match = String(card?.card_info || '').match(/\[NEED:(\d+(?:\.\d+)?)\]/i)
  return match ? Math.max(0, Number(match[1]) || 0) : null
}

export const getConfirmedSgpCardQuantity = (card) => (
  getNeedMarkerQuantity(card) ?? Math.max(0, Number(card?.quantity) || 0)
)

export const isBzReservationCard = (card) => (
  /\[BZ_RESERVATION(?::[^\]]*)?\]/i.test(String(card?.card_info || ''))
)

export const getConfirmedSgpFromCards = (cards = []) => cards.reduce((sum, card) => {
  if (String(card?.status || '').toLowerCase() !== 'completed') return sum
  if (isBzReservationCard(card)) return sum
  const operation = String(card?.operation || '').toLowerCase()
  const info = String(card?.card_info || '').toLowerCase()
  const isTransferMarker = operation.includes('сгп') || operation.includes('пакування/сгп') || info.includes('[пряма передача]')
  if (!isTransferMarker) return sum
  return sum + getConfirmedSgpCardQuantity(card)
}, 0)

export const getConfirmedSgpFromFlow = (flowRows = [], cards = []) => {
  const cardsById = new Map(cards.filter(Boolean).map(card => [String(card.id), card]))
  const qtyByCard = new Map()

  flowRows.forEach((row, index) => {
    const stage = String(row?.stage_name || '').toLowerCase()
    if (!stage.includes('сгп') && !stage.includes('пакування')) return
    const card = cardsById.get(String(row.card_id || ''))
    if (isBzReservationCard(card)) return
    const needQuantity = getNeedMarkerQuantity(card)
    const quantity = needQuantity ?? Math.max(0, Number(row.total_good) || 0)
    const key = row.card_id ? String(row.card_id) : `row-${index}`
    qtyByCard.set(key, Math.max(qtyByCard.get(key) || 0, quantity))
  })

  return Array.from(qtyByCard.values()).reduce((sum, quantity) => sum + quantity, 0)
}

export const calculateTerminalMetrics = ({
  initialStock = 0,
  flowSgpQty = 0,
  confirmedSgpCardsQty = 0,
  finalScrapQty = 0,
  currentVkyaQty = 0
} = {}) => {
  const qBz = Math.max(0, Number(initialStock) || 0)
  const confirmedFlowSgp = Math.max(0, Number(flowSgpQty) || 0)
  const confirmedCardSgp = Math.max(0, Number(confirmedSgpCardsQty) || 0)
  const qSgp = confirmedFlowSgp > 0 ? confirmedFlowSgp : confirmedCardSgp
  const qScrap = Math.max(0, Number(finalScrapQty) || 0)
  const qVkya = Math.max(0, Number(currentVkyaQty) || 0)

  return {
    qBz,
    qSgp,
    qScrap,
    qVkya,
    wipContribution: qBz + qSgp + qVkya
  }
}

export const calculateCurrentVkyaQuantity = ({
  observedScrapQty = 0,
  finalScrapQty = 0,
  returnedToRouteQty = 0
} = {}) => Math.max(
  0,
  (Number(observedScrapQty) || 0) -
  (Number(finalScrapQty) || 0) -
  (Number(returnedToRouteQty) || 0)
)
