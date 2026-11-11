export const PAINTING_TYPES = [
  { value: 'none', label: 'Без фарбування', badgeColor: '#6b7280' },
  { value: 'full', label: 'Повне фарбування', badgeColor: '#10b981' },
  { value: 'edges', label: 'Фарбування торців', badgeColor: '#f59e0b' }
]

// Фіксований колір основного виробу при повному фарбуванні
export const FULL_PAINTING_BASE_COLOR = 'Чорний'

// Можливі кольори фарбування торців (для повного фарбування та фарбування торців)
export const EDGE_PAINTING_COLORS = [
  'Помаранчевий',
  'Червоний',
  'Синій'
]

// Для зворотної сумісності з існуючими селектами
export const DEFAULT_PAINTING_COLORS = EDGE_PAINTING_COLORS

export function formatPaintingColor(type, edgeColor) {
  if (!edgeColor) return ''
  if (type === 'full') {
    return `${FULL_PAINTING_BASE_COLOR} (торці: ${edgeColor})`
  }
  if (type === 'edges') {
    return edgeColor
  }
  return edgeColor
}

export function extractEdgeColor(colorStr) {
  if (!colorStr) return ''
  const match = colorStr.match(/торці:\s*([^)]+)/i)
  if (match) return match[1].trim()
  return colorStr
}

export function getOrderPaintingInfo(order) {
  if (!order) return { type: 'none', color: '', edgeColor: '', baseColor: '', notes: '' }

  // 1. Check direct fields if present
  let type = order.painting_type
  let color = order.painting_color || ''
  let notes = order.painting_notes || ''
  let edgeColor = order.painting_edge_color || ''
  let baseColor = ''

  // 2. Structured report JSON
  try {
    const report = typeof order.report === 'string' ? JSON.parse(order.report) : (order.report || {})
    if (report?.painting) {
      if (!type) type = report.painting.type
      if (!color) color = report.painting.color
      if (!notes) notes = report.painting.notes
      if (!edgeColor) edgeColor = report.painting.edge_color
      if (!baseColor) baseColor = report.painting.base_color
    }
  } catch (e) {}

  type = type || 'none'
  if (type === 'full') {
    baseColor = baseColor || FULL_PAINTING_BASE_COLOR
  } else {
    baseColor = baseColor || ''
  }
  if (!edgeColor && color) {
    edgeColor = extractEdgeColor(color)
  }

  return {
    type,
    color,
    edgeColor: edgeColor || '',
    baseColor: baseColor || '',
    notes
  }
}

