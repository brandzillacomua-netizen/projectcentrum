export const PAINTING_TYPES = [
  { value: 'none', label: 'Без фарбування', badgeColor: '#6b7280' },
  { value: 'full', label: 'Повне фарбування', badgeColor: '#10b981' },
  { value: 'edges', label: 'Фарбування торців', badgeColor: '#f59e0b' }
]

// Попередній список до надання клієнтом точного списку кольорів
export const DEFAULT_PAINTING_COLORS = [
  'Зелений',
  'Червоний',
  'Чорний мат',
  'Чорний глянець',
  'Білий',
  'Синій',
  'Жовтий',
  'Сірий'
]

export function getOrderPaintingInfo(order) {
  if (!order) return { type: 'none', color: '', notes: '' }

  // 1. Check direct fields if present
  if (order.painting_type) {
    return {
      type: order.painting_type,
      color: order.painting_color || '',
      notes: order.painting_notes || ''
    }
  }

  // 2. Structured report JSON
  try {
    const report = typeof order.report === 'string' ? JSON.parse(order.report) : (order.report || {})
    if (report?.painting) {
      return {
        type: report.painting.type || 'none',
        color: report.painting.color || '',
        notes: report.painting.notes || ''
      }
    }
  } catch (e) {}

  return { type: 'none', color: '', notes: '' }
}

