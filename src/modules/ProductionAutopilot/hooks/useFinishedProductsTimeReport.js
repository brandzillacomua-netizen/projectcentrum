import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../supabase'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers'
import { extractLogMinutes, normalizeStageGroup, resolveProductBomParts } from '../utils/autopilotEngine'

const STAGE_ORDER = [
  'Розкрій',
  'Буфер Розкрій',
  'Галтовка',
  'Буфер Галтовка',
  'Прийомка',
  'Буфер Прийомка',
  'Сортування',
  'Буфер Сортування',
  'Пресування',
  'Фарбування',
  'Доопрацювання',
  'Пакування'
]

const OPTIONAL_BUFFER_STAGES = [
  'Буфер Пресування',
  'Буфер Фарбування',
  'Буфер Доопрацювання',
  'Буфер Інше'
]

export function useFinishedProductsTimeReport({
  enabled = true,
  dateFrom,
  dateTo,
  orders = [],
  workCards = [],
  nomenclatures = [],
  products = [],
  bomItems = []
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reportRows, setReportRows] = useState([])
  const [summary, setSummary] = useState({
    totalProducts: 0,
    totalFinishedUnits: 0,
    totalMinutes: 0
  })

  // Refs prevent background MESContext updates from re-triggering full date-range fetches
  const ordersRef = useRef(orders)
  const workCardsRef = useRef(workCards)
  const nomenclaturesRef = useRef(nomenclatures)
  const productsRef = useRef(products)
  const bomItemsRef = useRef(bomItems)
  ordersRef.current = orders
  workCardsRef.current = workCards
  nomenclaturesRef.current = nomenclatures
  productsRef.current = products
  bomItemsRef.current = bomItems

  const buildBucketsFromAggregated = useCallback(async (aggRows) => {
    const curOrders = ordersRef.current || []
    const curNoms = nomenclaturesRef.current || []
    const curProducts = productsRef.current || []
    const curBomItems = bomItemsRef.current || []

    const orderById = new Map(curOrders.map(o => [String(o.id), o]))
    const missingOrderIds = [...new Set(
      (aggRows || []).map(r => r.order_id).filter(id => id && !orderById.has(String(id)))
    )]

    if (missingOrderIds.length > 0) {
      const orderChunks = []
      for (let i = 0; i < missingOrderIds.length; i += 100) {
        orderChunks.push(missingOrderIds.slice(i, i + 100))
      }
      const resList = await Promise.all(
        orderChunks.map(chunk => supabase.from('orders').select('*, order_items(*)').in('id', chunk))
      )
      resList.forEach(({ data }) => {
        ;(data || []).forEach(o => orderById.set(String(o.id), o))
      })
    }

    const productById = new Map(curProducts.map(p => [String(p.id), p]))
    const nomById = new Map(curNoms.map(n => [String(n.id), n]))
    const productBuckets = new Map()

    const presentOptionalBuffers = new Set()

    ;(aggRows || []).forEach(row => {
      const stageGroup = row.stage_group
      if (!stageGroup) return
      if (OPTIONAL_BUFFER_STAGES.includes(stageGroup)) {
        presentOptionalBuffers.add(stageGroup)
      }
      const orderId = row.order_id ? String(row.order_id) : null
      const order = orderId ? orderById.get(orderId) : null
      const productKey = order ? `${order.id}` : 'no-order'

      const firstOi = Array.isArray(order?.order_items) && order.order_items.length > 0 ? order.order_items[0] : null
      const resolvedProduct =
        order?.product_name ||
        (order?.product_id ? productById.get(String(order.product_id))?.name : '') ||
        (firstOi?.nomenclature_id ? nomById.get(String(firstOi.nomenclature_id))?.name : '') ||
        firstOi?.name ||
        firstOi?.product_name ||
        ''
      const productName =
        resolvedProduct ||
        (order ? `Наряд №${order.order_num}` : 'Без прив’язки до виробу/наряду')
      const orderNum = order?.order_num || '—'

      if (!productBuckets.has(productKey)) {
        const itemsQtySum = Array.isArray(order?.order_items)
          ? order.order_items.reduce((s, oi) => s + (Number(oi?.quantity) || 0), 0)
          : 0
        productBuckets.set(productKey, {
          key: productKey,
          orderId: order?.id || null,
          orderNum,
          productName,
          customer: order?.customer || '',
          orderStatus: order?.status || '',
          orderQty: Number(order?.quantity || itemsQtySum || 0),
          totalMinutes: 0,
          totalScrap: 0,
          partsMap: new Map()
        })
      }
      const bucket = productBuckets.get(productKey)

      const rawNomId = row.nomenclature_id
      const canonNomId = resolveCanonicalNomId(rawNomId, curNoms) || String(rawNomId || 'unknown')
      const nom = nomById.get(canonNomId) || null

      if (!bucket.partsMap.has(canonNomId)) {
        bucket.partsMap.set(canonNomId, {
          nomId: canonNomId,
          nomName: nom?.name || `Деталь ${canonNomId.slice(0, 8)}`,
          nomCode: nom?.code || '',
          totalMinutes: 0,
          qtyCompleted: 0,
          scrapQty: 0,
          stages: {},
          stageCards: {},
          stageTotals: {}
        })
      }
      const part = bucket.partsMap.get(canonNomId)
      const mins = Number(row.total_minutes || 0)
      const qty = Number(row.qty_completed || 0)
      const scrap = Number(row.scrap_qty || 0)
      const cardsCnt = Number(row.cards_count || 0)

      part.totalMinutes += mins
      part.scrapQty += scrap
      part.stages[stageGroup] = (part.stages[stageGroup] || 0) + mins
      part.stageCards[stageGroup] = (part.stageCards[stageGroup] || 0) + cardsCnt
      part.stageTotals[stageGroup] = (part.stageTotals[stageGroup] || 0) + qty
      part.qtyCompleted = Math.max(0, ...Object.values(part.stageTotals))

      bucket.totalMinutes += mins
      bucket.totalScrap += scrap
    })

    // Seed all BOM parts of each order (with 0 if no cards/history yet)
    productBuckets.forEach(bucket => {
      if (!bucket.orderId) return
      const order = orderById.get(String(bucket.orderId))
      if (!order) return
      const bomParts = resolveProductBomParts(order, curBomItems, curNoms)
      bomParts.forEach(bp => {
        if (!bucket.partsMap.has(bp.nomId)) {
          bucket.partsMap.set(bp.nomId, {
            nomId: bp.nomId,
            nomName: bp.nomName,
            nomCode: bp.nomCode,
            totalMinutes: 0,
            qtyCompleted: 0,
            scrapQty: 0,
            stages: {},
            stageCards: {},
            stageTotals: {}
          })
        }
      })
    })

    const activeStageColumns = [
      ...STAGE_ORDER,
      ...OPTIONAL_BUFFER_STAGES.filter(st => presentOptionalBuffers.has(st))
    ]

    const rows = [...productBuckets.values()]
      .map(b => ({
        ...b,
        parts: [...b.partsMap.values()].sort((a, c) => c.totalMinutes - a.totalMinutes),
        stageColumns: activeStageColumns
      }))
      .sort((a, b) => b.totalMinutes - a.totalMinutes)

    setReportRows(rows)
    setSummary({
      totalProducts: rows.length,
      totalFinishedUnits: rows.reduce((s, r) => s + (r.orderQty || 0), 0),
      totalMinutes: rows.reduce((s, r) => s + r.totalMinutes, 0)
    })
  }, [])

  const loadReport = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    setError(null)
    try {
      const startIso = `${dateFrom}T00:00:00.000Z`
      const endIso = `${dateTo}T23:59:59.999Z`

      // 1. Fast Path: Server-side SQL aggregation (~50-150ms for any date range)
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('rpc_get_finished_products_time_report', {
          p_start: startIso,
          p_end: endIso
        })
        if (!rpcErr && Array.isArray(rpcData)) {
          await buildBucketsFromAggregated(rpcData)
          return
        }
      } catch (_) {}

      // 2. Fallback Path (if RPC migration not yet run): parallelized client aggregation
      const historyLogs = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error: histErr } = await supabase
          .from('work_card_history')
          .select('card_id, nomenclature_id, stage_name, qty_completed, scrap_qty, started_at, completed_at')
          .gte('completed_at', startIso)
          .lte('completed_at', endIso)
          .range(from, from + pageSize - 1)
        if (histErr) throw histErr
        if (!data || data.length === 0) break
        historyLogs.push(...data)
        if (data.length < pageSize) break
        from += pageSize
      }

      const cardOrderMap = new Map((workCardsRef.current || []).map(c => [String(c.id), c]))
      const missingCardIds = [...new Set(
        historyLogs.map(l => l.card_id).filter(id => id && !cardOrderMap.has(String(id)))
      )]
      if (missingCardIds.length > 0) {
        const cardChunks = []
        for (let i = 0; i < missingCardIds.length; i += 200) {
          cardChunks.push(missingCardIds.slice(i, i + 200))
        }
        const cardsRes = await Promise.all(
          cardChunks.map(chunk =>
            supabase.from('work_cards').select('id, order_id, nomenclature_id, quantity').in('id', chunk)
          )
        )
        cardsRes.forEach(({ data }) => {
          ;(data || []).forEach(c => cardOrderMap.set(String(c.id), c))
        })
      }

      const perCardStage = new Map()
      historyLogs.forEach(log => {
        const stageGroup = normalizeStageGroup(log.stage_name, { includeBuffers: true })
        const card = log.card_id ? cardOrderMap.get(String(log.card_id)) : null
        const orderId = card?.order_id || null
        const nomId = log.nomenclature_id || card?.nomenclature_id || null
        const key = `${orderId || ''}::${nomId || ''}::${stageGroup}::${log.card_id || ''}`
        const cur = perCardStage.get(key) || {
          order_id: orderId,
          nomenclature_id: nomId,
          stage_group: stageGroup,
          card_qty: Number(card?.quantity || 0),
          mins: 0,
          qty: 0,
          scrap: 0
        }
        cur.mins += extractLogMinutes(log)
        cur.qty += Number(log.qty_completed || 0)
        cur.scrap += Number(log.scrap_qty || 0)
        perCardStage.set(key, cur)
      })

      const aggMap = new Map()
      perCardStage.forEach(v => {
        const k = `${v.order_id || ''}::${v.nomenclature_id || ''}::${v.stage_group}`
        const cur = aggMap.get(k) || {
          order_id: v.order_id,
          nomenclature_id: v.nomenclature_id,
          stage_group: v.stage_group,
          total_minutes: 0,
          qty_completed: 0,
          scrap_qty: 0,
          cards_count: 0
        }
        cur.total_minutes += v.mins
        cur.qty_completed += v.card_qty > 0 ? Math.min(v.card_qty, v.qty) : v.qty
        cur.scrap_qty += v.scrap
        cur.cards_count += 1
        aggMap.set(k, cur)
      })

      await buildBucketsFromAggregated([...aggMap.values()])
    } catch (err) {
      console.error('[useFinishedProductsTimeReport] Error:', err)
      setError(err.message || 'Помилка завантаження звіту')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, buildBucketsFromAggregated])

  useEffect(() => {
    if (enabled) {
      loadReport()
    }
  }, [enabled, loadReport])

  return {
    loading,
    error,
    reportRows,
    summary,
    reload: loadReport
  }
}
