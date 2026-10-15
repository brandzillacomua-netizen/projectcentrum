export const canCompleteSortingCard = card => (
  card?.status === 'in-progress' && card?.operation === 'Сортування'
)

export const applySortingCompletionToCards = (cards, {
  cardId,
  goodQty,
  reworkQty,
  completedAt
}) => (cards || []).map(card => (
  String(card.id) === String(cardId)
    ? {
        ...card,
        status: 'at-shop2-buffer',
        operation: 'Сортування',
        quantity: Math.max(0, Number(goodQty) || 0) + Math.max(0, Number(reworkQty) || 0),
        used_in_shop2_qty: Math.max(0, Number(reworkQty) || 0),
        completed_at: completedAt || new Date().toISOString()
      }
    : card
))
