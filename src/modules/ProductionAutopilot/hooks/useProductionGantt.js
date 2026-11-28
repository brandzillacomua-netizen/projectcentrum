import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../../supabase'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers'
import { isBufferStageLog } from '../utils/autopilotEngine'

export const GANTT_STAGE_ORDER = [
  'Розкрій',
  'Буфер Розкрій',
  'Галтовка',
  'Буфер Галтовка',
  'Прийомка',
  'Буфер Прийомка',
  'Сортування',
  'Буфер Сортування',
  'Пресування',
  'Буфер Пресування',
  'Фарбування',
  'Буфер Фарбування',
  'Доопрацювання',
  'Буфер Доопрацювання',
  'Пакування',
  'Буфер Інше',
  'Інше'
]

async function fetchRpcAllPages(fnName, params) {
  const all = []
  const pageSize = 1000
  let from = 0
  while (true) {
    const { data, error } = await supabase.rpc(fnName, params).range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    if (!Array.isArray(data) || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
    from += pageSize
  }
  return { data: all, error: null }
}

export function useProductionGantt({
  enabled = true,
  dateFrom,
  dateTo,
  orders = [],
  nomenclatures = [],
  products = []
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [ganttOrders, setGanttOrders] = useState([])
  const [orderPartsMap, setOrderPartsMap] = useState(() => new Map())
  const [loadingOrderParts, setLoadingOrderParts] = useState(() => new Set())

  const ordersRef = useRef(orders)
  const nomsRef = useRef(nomenclatures)
  const productsRef = useRef(products)
  ordersRef.current = orders
  nomsRef.current = nomenclatures
  productsRef.current = products

  const loadGantt = useCallback(async () => {
    if (!dateFrom || !dateTo) return
    setLoading(true)
    setError(null)
    setOrderPartsMap(new Map())
    try {
      const startIso = `${dateFrom}T00:00:00.000Z`
      const endIso = `${dateTo}T23:59:59.999Z`
      const { data: rows, error: rpcErr } = await fetchRpcAllPages('rpc_get_production_gantt_timeline', {
        p_start: startIso,
        p_end: endIso,
        p_order_id: null
      })
      if (rpcErr) throw rpcErr

      const curOrders = ordersRef.current || []
      const curNoms = nomsRef.current || []
      const curProducts = productsRef.current || []

      const orderById = new Map(curOrders.map(o => [String(o.id), o]))
      const missingIds = [...new Set(
        (rows || []).map(r => r.order_id).filter(id => id && !orderById.has(String(id)))
      )]
      if (missingIds.length > 0) {
        const chunks = []
        for (let i = 0; i < missingIds.length; i += 100) chunks.push(missingIds.slice(i, i + 100))
        const resList = await Promise.all(
          chunks.map(chunk => supabase.from('orders').select('*, order_items(*)').in('id', chunk))
        )
        resList.forEach(({ data }) => {
          ;(data || []).forEach(o => orderById.set(String(o.id), o))
        })
      }

      const productById = new Map(curProducts.map(p => [String(p.id), p]))
      const nomById = new Map(curNoms.map(n => [String(n.id), n]))
      const buckets = new Map()

      const ensureOrderBucket = (orderId) => {
        const key = String(orderId)
        if (!buckets.has(key)) {
          const order = orderById.get(key) || null
          const firstOi = Array.isArray(order?.order_items) && order.order_items.length > 0 ? order.order_items[0] : null
          const resolvedProduct =
            order?.product_name ||
            (order?.product_id ? productById.get(String(order.product_id))?.name : '') ||
            (firstOi?.nomenclature_id ? nomById.get(String(firstOi.nomenclature_id))?.name : '') ||
            firstOi?.name ||
            firstOi?.product_name ||
            ''
          const itemsQtySum = Array.isArray(order?.order_items)
            ? order.order_items.reduce((s, oi) => s + (Number(oi?.quantity) || 0), 0)
            : 0
          const deadlineMs = order?.deadline ? new Date(order.deadline).getTime() : null

          buckets.set(key, {
            orderId: key,
            orderNum: order?.order_num || '—',
            productName: resolvedProduct || (order ? `Наряд №${order.order_num}` : `Наряд ${key.slice(0, 8)}`),
            customer: order?.customer || '',
            orderStatus: order?.status || '',
            orderQty: Number(order?.quantity || itemsQtySum || 0),
            deadline: order?.deadline || null,
            deadlineMs: deadlineMs && Number.isFinite(deadlineMs) ? deadlineMs : null,
            orderSegments: [],
            stagesMap: new Map()
          })
        }
        return buckets.get(key)
      }

      ;(rows || []).forEach(r => {
        if (!r.order_id || !r.segment_start || !r.segment_end) return
        const startMs = new Date(r.segment_start).getTime()
        const endMs = new Date(r.segment_end).getTime()
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return

        const b = ensureOrderBucket(r.order_id)
        const seg = {
          startMs,
          endMs,
          minutes: (endMs - startMs) / 60000,
          cardsCount: Number(r.cards_count || 0)
        }

        if (r.scope === 'order') {
          b.orderSegments.push(seg)
        } else if (r.scope === 'stage' && r.stage_group) {
          if (!b.stagesMap.has(r.stage_group)) {
            b.stagesMap.set(r.stage_group, {
              stageGroup: r.stage_group,
              isBuffer: isBufferStageLog(r.stage_group),
              segments: [],
              totalMinutes: 0,
              cardsCount: 0,
              firstStartMs: Infinity,
              lastEndMs: -Infinity
            })
          }
          const st = b.stagesMap.get(r.stage_group)
          st.segments.push(seg)
          st.totalMinutes += seg.minutes
          st.cardsCount += seg.cardsCount
          if (startMs < st.firstStartMs) st.firstStartMs = startMs
          if (endMs > st.lastEndMs) st.lastEndMs = endMs
        }
      })

      const result = [...buckets.values()]
        .map(b => {
          const allStarts = b.orderSegments.map(s => s.startMs)
          const allEnds = b.orderSegments.map(s => s.endMs)
          const firstStartMs = allStarts.length > 0 ? Math.min(...allStarts) : 0
          const lastEndMs = allEnds.length > 0 ? Math.max(...allEnds) : 0
          const activeMinutes = b.orderSegments.reduce((s, seg) => s + seg.minutes, 0)
          const leadTimeMinutes = lastEndMs > firstStartMs ? (lastEndMs - firstStartMs) / 60000 : 0

          const stages = [...b.stagesMap.values()].sort((a, c) => {
            const ia = GANTT_STAGE_ORDER.indexOf(a.stageGroup)
            const ic = GANTT_STAGE_ORDER.indexOf(c.stageGroup)
            return (ia === -1 ? 999 : ia) - (ic === -1 ? 999 : ic)
          })

          return {
            ...b,
            firstStartMs,
            lastEndMs,
            activeMinutes,
            leadTimeMinutes,
            stages
          }
        })
        .filter(b => b.firstStartMs > 0 && b.lastEndMs > 0)
        .sort((a, b) => a.firstStartMs - b.firstStartMs)

      setGanttOrders(result)
    } catch (err) {
      console.error('[useProductionGantt] Error:', err)
      setError(err.message || 'Помилка завантаження діаграми Ганта')
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo])

  const loadOrderParts = useCallback(async (orderId) => {
    const key = String(orderId)
    if (!orderId || !dateFrom || !dateTo) return
    setLoadingOrderParts(prev => new Set(prev).add(key))
    try {
      const startIso = `${dateFrom}T00:00:00.000Z`
      const endIso = `${dateTo}T23:59:59.999Z`
      const { data: rows, error: rpcErr } = await fetchRpcAllPages('rpc_get_production_gantt_timeline', {
        p_start: startIso,
        p_end: endIso,
        p_order_id: orderId
      })
      if (rpcErr) throw rpcErr

      const curNoms = nomsRef.current || []
      const nomById = new Map(curNoms.map(n => [String(n.id), n]))
      const byStage = new Map()

      ;(rows || []).forEach(r => {
        if (r.scope !== 'part' || !r.stage_group || !r.segment_start || !r.segment_end) return
        const startMs = new Date(r.segment_start).getTime()
        const endMs = new Date(r.segment_end).getTime()
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return

        const canonNomId = resolveCanonicalNomId(r.nomenclature_id, curNoms) || String(r.nomenclature_id || 'unknown')
        const nom = nomById.get(canonNomId) || null
        if (!byStage.has(r.stage_group)) byStage.set(r.stage_group, new Map())
        const partsMap = byStage.get(r.stage_group)
        if (!partsMap.has(canonNomId)) {
          partsMap.set(canonNomId, {
            nomId: canonNomId,
            nomName: nom?.name || `Деталь ${canonNomId.slice(0, 8)}`,
            nomCode: nom?.code || '',
            segments: [],
            totalMinutes: 0,
            cardsCount: 0
          })
        }
        const p = partsMap.get(canonNomId)
        const mins = (endMs - startMs) / 60000
        p.segments.push({ startMs, endMs, minutes: mins, cardsCount: Number(r.cards_count || 0) })
        p.totalMinutes += mins
        p.cardsCount += Number(r.cards_count || 0)
      })

      const normalizedByStage = new Map()
      byStage.forEach((partsMap, st) => {
        normalizedByStage.set(
          st,
          [...partsMap.values()].sort((a, b) => (a.segments[0]?.startMs || 0) - (b.segments[0]?.startMs || 0))
        )
      })

      setOrderPartsMap(prev => {
        const next = new Map(prev)
        next.set(key, normalizedByStage)
        return next
      })
    } catch (err) {
      console.error('[useProductionGantt] loadOrderParts error:', err)
    } finally {
      setLoadingOrderParts(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [dateFrom, dateTo])

  useEffect(() => {
    if (enabled) loadGantt()
  }, [enabled, loadGantt])

  return {
    loading,
    error,
    ganttOrders,
    orderPartsMap,
    loadingOrderParts,
    loadOrderParts,
    reload: loadGantt
  }
}
