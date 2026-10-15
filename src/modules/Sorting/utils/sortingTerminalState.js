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

const finiteNonNegative = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export const buildSortingStatusReconciliation = ({
  result,
  fallbackGoodQty,
  fallbackReworkQty,
  completedAt
}) => {
  const goodQty = finiteNonNegative(result?.good_qty, finiteNonNegative(fallbackGoodQty))
  const reworkQty = finiteNonNegative(result?.rework_qty, finiteNonNegative(fallbackReworkQty))

  return {
    status: 'at-shop2-buffer',
    operation: 'Сортування',
    quantity: goodQty + reworkQty,
    used_in_shop2_qty: reworkQty,
    completed_at: completedAt || new Date().toISOString(),
    updated_at: completedAt || new Date().toISOString()
  }
}
