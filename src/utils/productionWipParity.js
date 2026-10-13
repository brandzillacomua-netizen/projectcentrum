const SORTING_LIVE_STATUSES = new Set(['in-progress', 'at-buffer'])

export const isLiveSortingCard = card => (
  String(card?.operation || '').trim() === 'Сортування' &&
  SORTING_LIVE_STATUSES.has(String(card?.status || '').toLowerCase())
)

export const getShop2BufferRemaining = card => {
  if (String(card?.status || '').toLowerCase() !== 'at-shop2-buffer') return 0
  return Math.max(0, (Number(card?.quantity) || 0) - (Number(card?.used_in_shop2_qty) || 0))
}

export const mergeCardsPreferLive = (liveCards = [], backgroundCards = []) => (
  Array.from(new Map(
    [...(backgroundCards || []), ...(liveCards || [])]
      .filter(Boolean)
      .map(card => [String(card.id), card])
  ).values())
)

export const getUnassignedShop2BufferCards = (cards = [], assignedCardIds = new Set()) => (
  (cards || []).filter(card => (
    getShop2BufferRemaining(card) > 0 &&
    !assignedCardIds.has(String(card.id))
  ))
)
