import { getOrderPaintingInfo, FULL_PAINTING_BASE_COLOR } from '../modules/Manager/constants/paintingConstants.js'
import { getPartShop2RoutingFlags, resolveCanonicalNomId } from '../modules/Nomenclature/utils/nomenclatureHelpers.js'

const PAINT_COLOR_SWATCHES = {
  'чорний': '#0f172a',
  'помаранчевий': '#f97316',
  'червоний': '#ef4444',
  'синій': '#3b82f6'
}

export function getPaintingColorSwatch(colorName = '') {
  const norm = String(colorName || '').trim().toLowerCase()
  return PAINT_COLOR_SWATCHES[norm] || '#ec4899'
}

export function isShop2CardTag(cardInfo = '') {
  const info = String(cardInfo || '')
  return info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')
}

function buildPaintingDisplay(orderPainting) {
  if (!orderPainting || (orderPainting.type !== 'full' && orderPainting.type !== 'edges')) {
    return null
  }
  const isFull = orderPainting.type === 'full'
  const baseColor = isFull ? (orderPainting.baseColor || FULL_PAINTING_BASE_COLOR) : ''
  const edgeColor = orderPainting.edgeColor || ''
  const typeLabel = isFull ? 'Повне фарбування' : 'Фарбування торців'

  const parts = []
  if (isFull && baseColor) parts.push(`База: ${baseColor}`)
  if (edgeColor) parts.push(`Торці: ${edgeColor}`)
  if (!parts.length && orderPainting.color) parts.push(orderPainting.color)

  return {
    type: orderPainting.type,
    typeLabel,
    baseColor,
    edgeColor,
    notes: orderPainting.notes || '',
    summaryText: parts.join(' · ') || typeLabel,
    baseSwatch: baseColor ? getPaintingColorSwatch(baseColor) : null,
    edgeSwatch: edgeColor ? getPaintingColorSwatch(edgeColor) : null
  }
}

/**
 * Resolves exact Shop 2 routing and painting instructions for a detail in the context of an order.
 * Only paints a detail when BOTH the detail allows painting (requiresPainting)
 * AND the manager's order specifies painting ('full' or 'edges').
 */
export function resolveShop2PartOrderRouting(nom, order) {
  const { requiresPressing, requiresPainting, isConfigured } = getPartShop2RoutingFlags(nom)
  const orderPainting = getOrderPaintingInfo(order)
  const orderRequestsPainting = orderPainting.type === 'full' || orderPainting.type === 'edges'
  const shouldPaint = Boolean(requiresPainting && orderRequestsPainting)
  const paintingDisplay = shouldPaint ? buildPaintingDisplay(orderPainting) : null

  let recommendedStage = 'Пресування'
  if (requiresPressing) {
    recommendedStage = 'Пресування'
  } else if (shouldPaint) {
    recommendedStage = 'Фарбування'
  } else if (isConfigured) {
    recommendedStage = 'Склад СГП (пряма передача)'
  }

  return {
    requiresPressing,
    requiresPainting,
    isRoutingConfigured: isConfigured,
    orderPainting,
    orderRequestsPainting,
    shouldPaint,
    paintBlockedByPartFlag: Boolean(isConfigured && !requiresPainting && orderRequestsPainting),
    paintSkippedByOrder: Boolean(requiresPainting && !orderRequestsPainting),
    recommendedStage,
    paintingDisplay
  }
}

function findCardOrder(card, orders = []) {
  if (!card || !Array.isArray(orders) || orders.length === 0) return null
  if (card.order_id) {
    const byId = orders.find(o => String(o.id) === String(card.order_id))
    if (byId) return byId
  }
  const orderNumMatch = String(card.card_info || '').match(/Наряд\s*№\s*([A-Za-z0-9\-/]+)/i)
  if (orderNumMatch?.[1]) {
    const targetNum = orderNumMatch[1].trim()
    const byNum = orders.find(o => String(o.order_num || '').trim() === targetNum)
    if (byNum) return byNum
  }
  return null
}

function findCardNom(card, nomenclatures = []) {
  if (!card || !Array.isArray(nomenclatures) || nomenclatures.length === 0) return null
  const direct = nomenclatures.find(n => String(n.id) === String(card.nomenclature_id))
  if (direct) return direct
  const canonicalId = resolveCanonicalNomId(card.nomenclature_id, nomenclatures)
  return nomenclatures.find(n => String(n.id) === String(canonicalId)) || null
}

/**
 * Resolves nomenclature, order, and Shop 2 routing/painting metadata for a work card.
 */
export function resolveShop2CardDisplayInfo(card, nomenclatures = [], orders = []) {
  const nom = findCardNom(card, nomenclatures)
  const order = findCardOrder(card, orders)
  const routing = resolveShop2PartOrderRouting(nom, order)
  return { nom, order, routing }
}

/**
 * Resolves aggregated Shop 2 routing & painting specs across active order pools of a buffer queue row.
 */
export function resolveShop2BufferRowRouting(row, nomenclatures = [], orders = []) {
  const canonicalId = resolveCanonicalNomId(row?.nomId, nomenclatures) || String(row?.nomId || '')
  const nom = (nomenclatures || []).find(n => String(n.id) === canonicalId) || null
  const { requiresPressing, requiresPainting, isConfigured } = getPartShop2RoutingFlags(nom)

  const activePools = (row?.ordersList || []).filter(o => Number(o.availableQty) > 0)
  const poolsToInspect = activePools.length > 0 ? activePools : (row?.ordersList || [])

  const paintingSpecs = []
  const seenKeys = new Set()
  let hasOrderRequestingPainting = false
  let hasOrderWithoutPainting = false

  poolsToInspect.forEach(pool => {
    const order = (orders || []).find(o => String(o.id) === String(pool.orderId))
    if (!order) return
    const orderPainting = getOrderPaintingInfo(order)
    if (orderPainting.type === 'full' || orderPainting.type === 'edges') {
      hasOrderRequestingPainting = true
      const display = buildPaintingDisplay(orderPainting)
      if (display) {
        const key = `${orderPainting.type}|${display.baseColor}|${display.edgeColor}|${display.notes}`
        if (!seenKeys.has(key)) {
          seenKeys.add(key)
          paintingSpecs.push({
            orderNum: order.order_num || pool.orderNum || '',
            orderId: order.id,
            ...display
          })
        }
      }
    } else {
      hasOrderWithoutPainting = true
    }
  })

  const shouldPaintAny = Boolean(requiresPainting && hasOrderRequestingPainting)

  let recommendedStage = 'Пресування'
  if (requiresPressing) {
    recommendedStage = 'Пресування'
  } else if (shouldPaintAny) {
    recommendedStage = 'Фарбування'
  } else if (isConfigured) {
    recommendedStage = 'Склад СГП (пряма передача)'
  }

  return {
    nom,
    requiresPressing,
    requiresPainting,
    isRoutingConfigured: isConfigured,
    hasOrderRequestingPainting,
    hasOrderWithoutPainting,
    shouldPaintAny,
    paintingSpecs: shouldPaintAny ? paintingSpecs : [],
    orderPaintingSpecsRaw: paintingSpecs,
    recommendedStage
  }
}

/**
 * Determines whether a Shop 2 card waiting after Pressing belongs in Painting Terminal.
 * Explicit Painting cards always appear; pressed buffer cards appear when painting is required
 * (or for legacy unconfigured details unless the order explicitly chose "Без фарбування").
 */
export function shouldCardGoToPaintingTerminal(card, nomenclatures = [], orders = []) {
  if (!card || !isShop2CardTag(card.card_info)) return false

  if (['Фарбування', 'Малярка'].includes(card.operation)) {
    return card.status === 'new' || card.status === 'in-progress'
  }

  if (card.status === 'at-buffer' && card.operation === 'Пресування') {
    const { order, routing } = resolveShop2CardDisplayInfo(card, nomenclatures, orders)
    if (routing.isRoutingConfigured) {
      // If part is configured as requiring painting, only queue in Painting if order also requests painting (or order wasn't loaded)
      if (!routing.requiresPainting) return false
      if (order) return routing.shouldPaint
      return true
    }
    // Legacy unconfigured details: respect explicit 'none' on order if loaded
    if (order && routing.orderPainting.type === 'none') return false
    return true
  }

  return false
}

export const SHOP2_TIMING_STAGES = [
  { key: 'pressing', stage: 'Пресування', icon: '🔩', color: '#ea580c', flagKey: 'requiresPressing' },
  { key: 'painting', stage: 'Фарбування', icon: '🎨', color: '#7c3aed', flagKey: 'requiresPainting' },
  { key: 'rework', stage: 'Доопрацювання', icon: '🛠️', color: '#0284c7', flagKey: null }
]

export function getShop2OperationKey(operationName = '') {
  const op = String(operationName || '').toLowerCase().trim()
  if (!op) return null
  if (op.includes('пресув') || op.includes('прес')) return 'pressing'
  if (op.includes('фарбуван') || op.includes('маляр') || op.includes('paint')) return 'painting'
  if (op.includes('доопрац') || op.includes('доработ') || op.includes('rework')) return 'rework'
  return null
}

/**
 * Extracts normalized Shop 2 per-unit planned timings (minutes per 1 detail) from nomenclature.
 */
export function getShop2OperationTimings(nom) {
  const raw = nom?.rule_params?.shop2_operation_timings || nom?.shop2_operation_timings || {}
  const parseMin = (val) => {
    if (val === '' || val === null || val === undefined) return 0
    const n = Number(String(val).replace(',', '.'))
    return Number.isFinite(n) && n > 0 ? n : 0
  }

  return {
    pressing: parseMin(raw.pressing ?? raw['Пресування']),
    painting: parseMin(raw.painting ?? raw['Фарбування']),
    rework: parseMin(raw.rework ?? raw['Доопрацювання']),
    notes: typeof raw.notes === 'string' ? raw.notes : ''
  }
}

/**
 * Returns planned minutes per 1 detail for the requested Shop 2 operation.
 */
export function getShop2UnitMinutes(nom, operationName) {
  const key = getShop2OperationKey(operationName)
  if (!key) return 0
  const timings = getShop2OperationTimings(nom)
  return timings[key] || 0
}

/**
 * Calculates total planned minutes for `quantity` details on the given Shop 2 operation.
 */
export function calculateShop2PlannedMinutes(nom, operationName, quantity) {
  const qty = Number(quantity) || 0
  if (qty <= 0) return 0
  const unitMinutes = getShop2UnitMinutes(nom, operationName)
  if (unitMinutes <= 0) return 0
  return Math.round(unitMinutes * qty * 100) / 100
}

/**
 * Resolves effective planned minutes for a Shop 2 work card (card.estimated_time or dynamic fallback).
 */
export function getShop2CardPlannedMinutes(card, nom) {
  if (!card) return 0
  const stored = Number(card.estimated_time || 0)
  if (stored > 0) return stored
  const storedSec = Number(card.estimated_seconds || 0)
  if (storedSec > 0) return Math.round((storedSec / 60) * 100) / 100
  const dynamicMins = calculateShop2PlannedMinutes(nom, card.operation, card.quantity)
  if (dynamicMins > 0) return dynamicMins
  if (nom?.time_per_unit) return Math.round(Number(nom.time_per_unit) * (Number(card.quantity) || 0) * 100) / 100
  return 0
}

export function formatShop2PlannedMinutes(minutes) {
  const mins = Number(minutes) || 0
  if (mins <= 0) return '—'
  const rounded = Math.round(mins)
  if (rounded < 60) {
    return mins % 1 !== 0 && mins < 10 ? `${mins} хв` : `${rounded} хв`
  }
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  return m === 0 ? `${h} год` : `${h} год ${m} хв`
}


