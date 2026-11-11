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

