import { resolveCanonicalNomId, getPartShop2RoutingFlags } from '../../Nomenclature/utils/nomenclatureHelpers'
import { isShop2CardTag } from '../../../utils/shop2RoutingUtils'

const MAX_VALID_LOG_MINUTES = 48 * 60

export function isBufferStageLog(stageName = '') {
  const s = String(stageName || '').toLowerCase()
  return s.includes('буфер') || s.includes('buffer') || s.includes('очікув')
}

export function normalizeStageGroup(stageName = '', { includeBuffers = false } = {}) {
  const s = String(stageName || '').toLowerCase()
  if (isBufferStageLog(s)) {
    if (!includeBuffers) return 'Буфер'
    if (s.includes('розкрій') || s.includes('порізк') || s.includes('чпу') || s.includes('фрез')) return 'Буфер Розкрій'
    if (s.includes('галтов')) return 'Буфер Галтовка'
    if (s.includes('прийом')) return 'Буфер Прийомка'
    if (s.includes('сортув')) return 'Буфер Сортування'
    if (s.includes('пресув') || s.includes('прес')) return 'Буфер Пресування'
    if (s.includes('фарбув') || s.includes('маляр')) return 'Буфер Фарбування'
    if (s.includes('доопрац') || s.includes('реставр')) return 'Буфер Доопрацювання'
    return 'Буфер Інше'
  }
  if (s.includes('розкрій') || s.includes('порізк') || s.includes('чпу') || s.includes('фрез')) return 'Розкрій'
  if (s.includes('галтов')) return 'Галтовка'
  if (s.includes('прийом')) return 'Прийомка'
  if (s.includes('сортув')) return 'Сортування'
  if (s.includes('пресув') || s.includes('прес')) return 'Пресування'
  if (s.includes('фарбув') || s.includes('маляр')) return 'Фарбування'
  if (s.includes('доопрац') || s.includes('реставр')) return 'Доопрацювання'
  if (s.includes('пакув') || s.includes('сгп')) return 'Пакування'
  return 'Інше'
}

export function extractLogMinutes(log) {
  if (!log) return 0
  if (Number(log.duration_seconds) > 0) {
    const mins = Number(log.duration_seconds) / 60
    return mins > 0 && mins <= MAX_VALID_LOG_MINUTES ? mins : 0
  }
  if (log.started_at && log.completed_at) {
    const ms = new Date(log.completed_at).getTime() - new Date(log.started_at).getTime()
    if (Number.isFinite(ms) && ms > 0) {
      const mins = ms / 60000
      return mins <= MAX_VALID_LOG_MINUTES ? mins : 0
    }
  }
  return 0
}

export function extractLogIntervalMs(log) {
  if (!log?.started_at || !log?.completed_at) return null
  const startMs = new Date(log.started_at).getTime()
  const rawEndMs = new Date(log.completed_at).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(rawEndMs) || rawEndMs <= startMs) return null
  const maxEndMs = startMs + MAX_VALID_LOG_MINUTES * 60000
  return [startMs, Math.min(rawEndMs, maxEndMs)]
}

/**
 * Merges overlapping [startMs, endMs] intervals and returns total wall-clock minutes.
 */
export function mergeIntervalsMinutes(intervals = []) {
  const valid = (intervals || [])
    .filter(iv => Array.isArray(iv) && Number.isFinite(iv[0]) && Number.isFinite(iv[1]) && iv[1] > iv[0])
    .sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (valid.length === 0) return 0

  let totalMs = 0
  let curStart = valid[0][0]
  let curEnd = valid[0][1]
  for (let i = 1; i < valid.length; i++) {
    const [s, e] = valid[i]
    if (s <= curEnd) {
      if (e > curEnd) curEnd = e
    } else {
      totalMs += curEnd - curStart
      curStart = s
      curEnd = e
    }
  }
  totalMs += curEnd - curStart
  return Math.round((totalMs / 60000) * 100) / 100
}

export function formatDurationHuman(totalMinutes) {
  const mins = Math.round(Number(totalMinutes) || 0)
  if (mins <= 0) return '—'
  if (mins < 60) return `${mins} хв`
  const totalHours = Math.floor(mins / 60)
  const remMins = mins % 60
  if (totalHours < 24) {
    return remMins === 0 ? `${totalHours} год` : `${totalHours} год ${remMins} хв`
  }
  const days = Math.floor(totalHours / 24)
  const remHours = totalHours % 24
  return remHours === 0 ? `${days} дн` : `${days} дн ${remHours} год`
}

/**
 * Builds empirical per-part & per-stage average timings and scrap rates from work_card_history.
 */
export function buildEmpiricalStageStats(workCardHistory = [], nomenclatures = []) {
  const byPartStage = new Map() // `${canonNomId}::${stageGroup}` -> { mins, qty, scrap, count }
  const byStageGlobal = new Map() // stageGroup -> { mins, qty, scrap, count }

  ;(workCardHistory || []).forEach(log => {
    const stageGroup = normalizeStageGroup(log.stage_name || log.operation)
    if (stageGroup === 'Буфер') return
    const mins = extractLogMinutes(log)
    const qty = Number(log.qty_completed || log.qty_at_start || 0)
    const scrap = Number(log.scrap_qty || 0)
    if (mins <= 0 && qty <= 0) return

    const canonNomId = resolveCanonicalNomId(log.nomenclature_id, nomenclatures) || String(log.nomenclature_id || '')

    if (canonNomId) {
      const key = `${canonNomId}::${stageGroup}`
      const cur = byPartStage.get(key) || { mins: 0, qty: 0, scrap: 0, count: 0 }
      cur.mins += mins
      cur.qty += qty
      cur.scrap += scrap
      cur.count += 1
      byPartStage.set(key, cur)
    }

    const gCur = byStageGlobal.get(stageGroup) || { mins: 0, qty: 0, scrap: 0, count: 0 }
    gCur.mins += mins
    gCur.qty += qty
    gCur.scrap += scrap
    gCur.count += 1
    byStageGlobal.set(stageGroup, gCur)
  })

  const getPartStageAvg = (nomId, stageGroup) => {
    const canon = resolveCanonicalNomId(nomId, nomenclatures) || String(nomId || '')
    const partStat = byPartStage.get(`${canon}::${stageGroup}`)
    if (partStat && partStat.qty > 0 && partStat.mins > 0) {
      return {
        avgMinutesPerUnit: partStat.mins / partStat.qty,
        scrapRate: partStat.scrap / Math.max(1, partStat.qty + partStat.scrap),
        samples: partStat.count,
        isFallback: false
      }
    }
    const gStat = byStageGlobal.get(stageGroup)
    if (gStat && gStat.qty > 0 && gStat.mins > 0) {
      return {
        avgMinutesPerUnit: gStat.mins / gStat.qty,
        scrapRate: gStat.scrap / Math.max(1, gStat.qty + gStat.scrap),
        samples: gStat.count,
        isFallback: true
      }
    }
    return { avgMinutesPerUnit: 0, scrapRate: 0, samples: 0, isFallback: true }
  }

  return { getPartStageAvg, byPartStage, byStageGlobal }
}

function isOrderActive(order) {
  const st = String(order?.status || '').toLowerCase()
  return !['completed', 'done', 'archived', 'cancelled', 'shipped'].includes(st)
}

const NON_PRODUCTION_TYPES = new Set([
  'hardware',
  'fastener',
  'consumable',
  'material',
  'raw',
  'packaging',
  'tool',
  'service'
])

function isProductionPart(nom, fallbackName = '') {
  const t = String(nom?.type || '').toLowerCase().trim()
  if (NON_PRODUCTION_TYPES.has(t)) return false
  const cat = String(nom?.category || '').toLowerCase().trim()
  if (NON_PRODUCTION_TYPES.has(cat)) return false
  if (t !== 'part' && t !== 'detail' && t !== 'assembly') {
    const n = String(nom?.name || fallbackName || '').toLowerCase()
    if (
      n.includes('гвинт') ||
      n.includes('гайка') ||
      n.includes('гайки') ||
      n.includes('стійка') ||
      n.includes('стійки') ||
      n.includes('шайба') ||
      n.includes('болт') ||
      n.includes('метиз') ||
      n.includes('din912') ||
      n.includes('iso7380')
    ) {
      return false
    }
  }
  return true
}

export function resolveProductBomParts(order, bomItems = [], nomenclatures = []) {
  const partsMap = new Map() // canonNomId -> { nomId, nomName, nomCode, qtyPerKit, nom }

  const addPart = (rawNomId, qtyPerKit, fallbackName = 'Деталь') => {
    const canonId = resolveCanonicalNomId(rawNomId, nomenclatures) || String(rawNomId || '')
    if (!canonId) return
    const nom = (nomenclatures || []).find(n => String(n.id) === canonId) || null
    if (!isProductionPart(nom, fallbackName)) return
    const existing = partsMap.get(canonId)
    if (existing) {
      existing.qtyPerKit += qtyPerKit
    } else {
      partsMap.set(canonId, {
        nomId: canonId,
        nomName: nom?.name || fallbackName,
        nomCode: nom?.code || nom?.nomenclature_code || '',
        qtyPerKit: Math.max(1, Number(qtyPerKit || 1)),
        nom
      })
    }
  }

  const findBomChildren = (parentId) => {
    if (!parentId) return []
    const canonParent = resolveCanonicalNomId(parentId, nomenclatures) || String(parentId)
    return (bomItems || []).filter(
      b => String(b.parent_id) === String(parentId) || String(b.parent_id) === canonParent
    )
  }

  const orderItems = Array.isArray(order?.order_items) ? order.order_items : []
  if (orderItems.length > 0) {
    orderItems.forEach(oi => {
      const itemNomId = oi?.nomenclature_id || oi?.product_id
      if (!itemNomId) return
      const children = findBomChildren(itemNomId)
      if (children.length > 0) {
        children.forEach(b => {
          addPart(b.child_id || b.nomenclature_id, Number(b.quantity_per_parent || b.quantity || 1))
        })
      } else {
        addPart(itemNomId, 1, oi?.name || oi?.product_name)
      }
    })
  }

  if (partsMap.size === 0) {
    const directParentId = order?.product_id || order?.nomenclature_id
    if (directParentId) {
      const children = findBomChildren(directParentId)
      children.forEach(b => {
        addPart(b.child_id || b.nomenclature_id, Number(b.quantity_per_parent || b.quantity || 1))
      })
    } else if (order?.product_name) {
      const pName = String(order.product_name).trim().toLowerCase()
      const matchedNom = (nomenclatures || []).find(
        n => String(n.name || '').trim().toLowerCase() === pName
      )
      if (matchedNom) {
        const children = findBomChildren(matchedNom.id)
        children.forEach(b => {
          addPart(b.child_id || b.nomenclature_id, Number(b.quantity_per_parent || b.quantity || 1))
        })
      }
    }
  }

  return [...partsMap.values()]
}

/**
 * Computes real-time Kit-Readiness per active order and priority queues for Shop 1 & Shop 2.
 */
export function computeProductionPriorities({
  orders = [],
  tasks = [],
  workCards = [],
  workCardHistory = [],
  inventory = [],
  nomenclatures = [],
  products = [],
  bomItems = []
}) {
  const { getPartStageAvg } = buildEmpiricalStageStats(workCardHistory, nomenclatures)
  const activeOrders = (orders || []).filter(isOrderActive)
  const productById = new Map((products || []).map(p => [String(p.id), p]))
  const nomById = new Map((nomenclatures || []).map(n => [String(n.id), n]))

  // Index work_cards by `${orderId}::${canonNomId}`
  const cardsByOrderPart = new Map()
  ;(workCards || []).forEach(c => {
    if (!c?.nomenclature_id || !c?.order_id) return
    const canonId = resolveCanonicalNomId(c.nomenclature_id, nomenclatures) || String(c.nomenclature_id)
    const key = `${c.order_id}::${canonId}`
    if (!cardsByOrderPart.has(key)) cardsByOrderPart.set(key, [])
    cardsByOrderPart.get(key).push(c)
  })

  // SGP / BZ inventory map by canonical nomId
  const sgpStockByNom = new Map()
  ;(inventory || []).forEach(inv => {
    if (!inv?.nomenclature_id) return
    const canonId = resolveCanonicalNomId(inv.nomenclature_id, nomenclatures) || String(inv.nomenclature_id)
    if (inv.type === 'finished' || inv.warehouse === 'sgp') {
      sgpStockByNom.set(canonId, (sgpStockByNom.get(canonId) || 0) + Math.max(0, Number(inv.total_qty || 0) - Number(inv.reserved_qty || 0)))
    }
  })

  const orderReadinessList = []
  const shop1Candidates = new Map() // canonNomId -> aggregated item
  const shop2Candidates = new Map() // canonNomId -> aggregated item

  const nowMs = Date.now()

  activeOrders.forEach(order => {
    const itemsQtySum = Array.isArray(order.order_items)
      ? order.order_items.reduce((s, oi) => s + (Number(oi?.quantity) || 0), 0)
      : 0
    const orderQty = Math.max(1, Number(order.quantity || itemsQtySum || 1))
    const bomParts = resolveProductBomParts(order, bomItems, nomenclatures)
    if (bomParts.length === 0) return

    const deadlineMs = order.deadline ? new Date(order.deadline).getTime() : null
    const daysLeft = deadlineMs && Number.isFinite(deadlineMs)
      ? Math.ceil((deadlineMs - nowMs) / 86400000)
      : null

    let bestBottleneck = null
    let minKitsReady = Infinity
    let minKitsCovered = Infinity
    let maxLeadMinutes = 0

    const partStatuses = bomParts.map(bp => {
      const cards = cardsByOrderPart.get(`${order.id}::${bp.nomId}`) || []
      let doneQty = 0
      let shop2BufferAvail = 0
      let inShop2Work = 0
      let inShop1Work = 0

      cards.forEach(c => {
        const qty = Number(c.quantity || 0)
        const isS2 =
          isShop2CardTag(c.card_info) ||
          ['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Склад СГП', 'Пакування'].includes(c.operation)
        if (isS2) {
          if (c.status === 'completed' || c.operation === 'Склад СГП') {
            doneQty += qty
          } else {
            inShop2Work += qty
          }
        } else if (c.status === 'at-shop2-buffer') {
          const avail = Math.max(0, qty - Number(c.used_in_shop2_qty || 0))
          shop2BufferAvail += avail
        } else if (c.status === 'completed') {
          const usedS2 = Number(c.used_in_shop2_qty || 0)
          if (usedS2 === 0) {
            doneQty += qty
          } else if (qty > usedS2) {
            shop2BufferAvail += qty - usedS2
          }
        } else {
          inShop1Work += qty
        }
      })

      const requiredTotal = orderQty * bp.qtyPerKit
      const readyPlusShop2 = doneQty + shop2BufferAvail + inShop2Work
      const totalCovered = readyPlusShop2 + inShop1Work

      const kitsReady = Math.min(orderQty, Math.floor(doneQty / bp.qtyPerKit))
      const kitsCovered = Math.min(orderQty, Math.floor(totalCovered / bp.qtyPerKit))
      const deficitForShop1 = Math.max(0, requiredTotal - totalCovered)

      const flags = getPartShop2RoutingFlags(bp.nom)
      const cutAvg = getPartStageAvg(bp.nomId, 'Розкрій')
      const tumbleAvg = getPartStageAvg(bp.nomId, 'Галтовка')
      const pressAvg = flags.requiresPressing ? getPartStageAvg(bp.nomId, 'Пресування') : { avgMinutesPerUnit: 0 }
      const paintAvg = flags.requiresPainting ? getPartStageAvg(bp.nomId, 'Фарбування') : { avgMinutesPerUnit: 0 }

      const unitLeadMinShop1ToEnd =
        cutAvg.avgMinutesPerUnit + tumbleAvg.avgMinutesPerUnit + pressAvg.avgMinutesPerUnit + paintAvg.avgMinutesPerUnit
      const unitLeadMinShop2ToEnd = pressAvg.avgMinutesPerUnit + paintAvg.avgMinutesPerUnit

      const estRemainingMin =
        deficitForShop1 > 0
          ? deficitForShop1 * Math.max(0.2, unitLeadMinShop1ToEnd)
          : (shop2BufferAvail > 0 ? shop2BufferAvail * Math.max(0.1, unitLeadMinShop2ToEnd) : 0)

      if (estRemainingMin > maxLeadMinutes) maxLeadMinutes = estRemainingMin

      if (kitsReady < minKitsReady) minKitsReady = kitsReady
      if (kitsCovered < minKitsCovered) minKitsCovered = kitsCovered

      const isWorseBottleneck =
        !bestBottleneck ||
        // 1. Parts with uncovered deficit (kitsCovered < orderQty) are the TRUE critical bottleneck
        (kitsCovered < orderQty && bestBottleneck.kitsCovered >= orderQty) ||
        (kitsCovered < orderQty && bestBottleneck.kitsCovered < orderQty && (
          kitsCovered < bestBottleneck.kitsCovered ||
          (kitsCovered === bestBottleneck.kitsCovered && estRemainingMin > bestBottleneck.estRemainingMin)
        )) ||
        // 2. If all parts are covered in WIP, pick the one with fewest ready on SGP (packing bottleneck)
        (kitsCovered >= orderQty && bestBottleneck.kitsCovered >= orderQty && (
          kitsReady < bestBottleneck.kitsReady ||
          (kitsReady === bestBottleneck.kitsReady && estRemainingMin > bestBottleneck.estRemainingMin) ||
          (kitsReady === bestBottleneck.kitsReady && estRemainingMin === bestBottleneck.estRemainingMin && deficitForShop1 > bestBottleneck.deficitForShop1)
        ))

      if (isWorseBottleneck) {
        bestBottleneck = {
          nomName: bp.nomName,
          kitsReady,
          kitsCovered,
          estRemainingMin,
          deficitForShop1,
          hasDeficit: kitsCovered < orderQty
        }
      }

      return {
        ...bp,
        doneQty,
        shop2BufferAvail,
        inShop2Work,
        inShop1Work,
        requiredTotal,
        deficitForShop1,
        kitsReady,
        kitsCovered,
        estRemainingMin,
        flags,
        cutAvg,
        paintAvg,
        unitLeadMinShop1ToEnd,
        unitLeadMinShop2ToEnd
      }
    })

    const bottleneckPart = bestBottleneck?.nomName || null

    const kitsReadyFinal = Number.isFinite(minKitsReady) ? minKitsReady : 0
    const kitsPct = Math.round((kitsReadyFinal / orderQty) * 100)
    const firstOi = Array.isArray(order.order_items) && order.order_items.length > 0 ? order.order_items[0] : null
    const resolvedProductName =
      order.product_name ||
      (order.product_id ? productById.get(String(order.product_id))?.name : '') ||
      (firstOi?.nomenclature_id ? nomById.get(String(firstOi.nomenclature_id))?.name : '') ||
      firstOi?.name ||
      firstOi?.product_name ||
      `Наряд №${order.order_num || '—'}`

    orderReadinessList.push({
      orderId: order.id,
      orderNum: order.order_num || '—',
      productName: resolvedProductName,
      customer: order.customer || '',
      orderQty,
      kitsReady: kitsReadyFinal,
      kitsPct,
      bottleneckPart: bottleneckPart || '—',
      daysLeft,
      deadline: order.deadline || null,
      estRemainingHours: Math.round((maxLeadMinutes / 60) * 10) / 10,
      parts: [...partStatuses]
        .sort((a, b) =>
          // Critical deficit parts first, then lowest SGP readiness
          (a.deficitForShop1 > 0 ? 0 : 1) - (b.deficitForShop1 > 0 ? 0 : 1) ||
          a.kitsCovered - b.kitsCovered ||
          a.kitsReady - b.kitsReady ||
          b.estRemainingMin - a.estRemainingMin
        )
        .map(ps => ({
          nomId: ps.nomId,
          nomName: ps.nomName,
          nomCode: ps.nomCode,
          qtyPerKit: ps.qtyPerKit,
          requiredTotal: ps.requiredTotal,
          doneQty: ps.doneQty,
          shop2BufferAvail: ps.shop2BufferAvail,
          inShop2Work: ps.inShop2Work,
          inShop1Work: ps.inShop1Work,
          deficitForShop1: ps.deficitForShop1,
          kitsReady: ps.kitsReady,
          kitsCovered: ps.kitsCovered,
          isBottleneck: ps.nomName === bottleneckPart,
          isCriticalDeficit: ps.deficitForShop1 > 0
        }))
    })

    // Feed Shop 1 & Shop 2 queues
    partStatuses.forEach(ps => {
      const deadlineBoost = daysLeft !== null ? Math.max(0, 40 - daysLeft * 4) : 10
      const kitGapRatio = 1 - ps.kitsCovered / Math.max(1, orderQty)
      const isOrderBottleneck = ps.nomName === bottleneckPart

      // Shop 1 Priority: parts with uncovered deficit or active Shop 1 work
      if (ps.deficitForShop1 > 0 || ps.inShop1Work > 0) {
        const scrapMult = 1 + Math.min(0.25, ps.cutAvg?.scrapRate || 0)
        const qtyWithScrap = Math.ceil(ps.deficitForShop1 * scrapMult)
        const score = Math.round(
          kitGapRatio * 45 +
          (isOrderBottleneck ? 25 : 0) +
          deadlineBoost +
          Math.min(15, (ps.unitLeadMinShop1ToEnd * Math.max(1, ps.deficitForShop1)) / 120)
        )
        const existing = shop1Candidates.get(ps.nomId) || {
          nomId: ps.nomId,
          nomName: ps.nomName,
          nomCode: ps.nomCode,
          deficitQty: 0,
          recommendedQty: 0,
          inWorkQty: 0,
          score: 0,
          orders: [],
          reasons: new Set(),
          avgCutMinPerUnit: ps.cutAvg?.avgMinutesPerUnit || 0,
          scrapRatePct: Math.round((ps.cutAvg?.scrapRate || 0) * 1000) / 10,
          etaMinutes: 0
        }
        existing.deficitQty += ps.deficitForShop1
        existing.recommendedQty += qtyWithScrap
        existing.inWorkQty += ps.inShop1Work
        existing.score = Math.max(existing.score, score)
        existing.etaMinutes = Math.max(existing.etaMinutes, Math.round(ps.unitLeadMinShop1ToEnd * Math.max(1, ps.deficitForShop1)))
        existing.orders.push(order.order_num)
        if (isOrderBottleneck) existing.reasons.add(`Гальмо комплекту (${resolvedProductName || order.order_num})`)
        if (daysLeft !== null && daysLeft <= 3) {
          existing.reasons.add(daysLeft <= 0 ? 'Прострочений дедлайн' : `Дедлайн через ${daysLeft} дн.`)
        }
        if (ps.deficitForShop1 > 0) existing.reasons.add(`Дефіцит ${ps.deficitForShop1} шт`)
        shop1Candidates.set(ps.nomId, existing)
      }

      // Shop 2 Priority: parts sitting in Shop 2 buffer ready to launch
      if (ps.shop2BufferAvail > 0) {
        const score = Math.round(
          kitGapRatio * 40 +
          (isOrderBottleneck ? 30 : 0) +
          deadlineBoost +
          (ps.flags.requiresPainting ? 8 : 0)
        )
        const existing = shop2Candidates.get(ps.nomId) || {
          nomId: ps.nomId,
          nomName: ps.nomName,
          nomCode: ps.nomCode,
          bufferAvailQty: 0,
          inWorkQty: 0,
          score: 0,
          orders: [],
          reasons: new Set(),
          requiresPressing: ps.flags.requiresPressing,
          requiresPainting: ps.flags.requiresPainting,
          paintingUnitsPerShelf: ps.flags.paintingUnitsPerShelf,
          etaMinutes: 0
        }
        existing.bufferAvailQty += ps.shop2BufferAvail
        existing.inWorkQty += ps.inShop2Work
        existing.score = Math.max(existing.score, score)
        existing.etaMinutes = Math.max(existing.etaMinutes, Math.round(ps.unitLeadMinShop2ToEnd * ps.shop2BufferAvail))
        existing.orders.push(order.order_num)
        if (isOrderBottleneck) existing.reasons.add(`Розблокує комплекти (${resolvedProductName || order.order_num})`)
        if (daysLeft !== null && daysLeft <= 3) {
          existing.reasons.add(daysLeft <= 0 ? 'Прострочений дедлайн' : `Дедлайн через ${daysLeft} дн.`)
        }
        if (ps.flags.requiresPainting && ps.flags.paintingUnitsPerShelf > 0) {
          const fullCassettes = Math.floor(existing.bufferAvailQty / ps.flags.paintingUnitsPerShelf)
          existing.cassettesHint = fullCassettes > 0
            ? `${fullCassettes} касет × ${ps.flags.paintingUnitsPerShelf} шт`
            : `${existing.bufferAvailQty}/${ps.flags.paintingUnitsPerShelf} шт (мікс)`
        }
        shop2Candidates.set(ps.nomId, existing)
      }
    })
  })

  orderReadinessList.sort((a, b) => {
    const aUrg = (a.daysLeft ?? 99) * 2 + a.kitsPct
    const bUrg = (b.daysLeft ?? 99) * 2 + b.kitsPct
    return aUrg - bUrg
  })

  const shop1Queue = [...shop1Candidates.values()]
    .map(it => ({ ...it, reasons: [...it.reasons], orders: [...new Set(it.orders)] }))
    .sort((a, b) => b.score - a.score)

  const shop2Queue = [...shop2Candidates.values()]
    .map(it => ({ ...it, reasons: [...it.reasons], orders: [...new Set(it.orders)] }))
    .sort((a, b) => b.score - a.score)

  return {
    orderReadinessList,
    shop1Queue,
    shop2Queue
  }
}
