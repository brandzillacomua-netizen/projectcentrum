import { supabase } from '../supabase'

let rpcUnavailableUntil = 0
const SUMMARY_CACHE_TTL_MS = 5 * 60 * 1000
const SUMMARY_FAILURE_BACKOFF_MS = 60 * 1000
const SUMMARY_RPC_UNAVAILABLE_BACKOFF_MS = 5 * 60 * 1000
const MAX_FALLBACK_RANGE_MS = 31 * 24 * 60 * 60 * 1000
const MAX_FALLBACK_ROWS = 10000
const summaryCache = new Map()
const summaryInFlight = new Map()
const summaryFailures = new Map()

const FINAL_STAGES = new Set(['пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'])

const getBoundedRange = (from, to) => {
  if (!from || !to) return null
  const fromMs = new Date(from).getTime()
  const toMs = new Date(to).getTime()
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || toMs < fromMs) return null
  if (toMs - fromMs > MAX_FALLBACK_RANGE_MS) return null
  return { from, to }
}

// This fallback is intentionally bounded. A missing RPC must never make every
// browser download the complete production history.
const fetchSummaryFallback = async (from, to) => {
  const range = getBoundedRange(from, to)
  if (!range) {
    throw new Error('Production summary RPC is unavailable; an explicit range of at most 31 days is required')
  }

  const pageSize = 1000
  let totalProduced = 0
  let totalScrap = 0
  let historyCount = 0

  for (let offset = 0; ; offset += pageSize) {
    let query = supabase
      .from('work_card_history')
      .select('stage_name,qty_completed,scrap_qty,completed_at,created_at')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
      .gte('completed_at', range.from)
      .lte('completed_at', range.to)

    const { data, error } = await query
    if (error) throw error
    for (const row of data || []) {
      historyCount += 1
      totalScrap += Number(row.scrap_qty) || 0
      if (FINAL_STAGES.has(String(row.stage_name || '').toLowerCase().trim())) {
        totalProduced += Number(row.qty_completed) || 0
      }
    }
    if (historyCount > MAX_FALLBACK_ROWS) {
      throw new Error(`Production summary fallback exceeded the safe ${MAX_FALLBACK_ROWS}-row limit`)
    }
    if (!data || data.length < pageSize) break
  }

  return { totalProduced, totalScrap, historyCount, source: 'bounded-fallback' }
}

export const fetchProductionSummary = async (from = null, to = null, options = {}) => {
  const force = options?.force === true
  const cacheKey = `${from || 'all'}:${to || 'all'}`
  const cached = summaryCache.get(cacheKey)
  const recentFailure = summaryFailures.get(cacheKey)

  if (!force && cached && Date.now() - cached.fetchedAt < SUMMARY_CACHE_TTL_MS) {
    return cached.value
  }
  // A forced freshness request may bypass the normal cache, but never the
  // outage circuit breaker. Otherwise every Realtime event can retry a sick DB.
  if (recentFailure && Date.now() < recentFailure.retryAfter) {
    if (cached) return { ...cached.value, source: 'stale-cache' }
    throw recentFailure.error
  }
  if (summaryInFlight.has(cacheKey)) return summaryInFlight.get(cacheKey)

  const request = (async () => {
    if (Date.now() >= rpcUnavailableUntil) {
      const { data, error } = await supabase.rpc('mes_production_summary', { p_from: from, p_to: to })
      if (!error && data) {
        const value = { ...data, source: 'database' }
        summaryCache.set(cacheKey, { value, fetchedAt: Date.now() })
        summaryFailures.delete(cacheKey)
        return value
      }
      if (error?.code === 'PGRST202' || error?.code === '42883') {
        rpcUnavailableUntil = Date.now() + SUMMARY_RPC_UNAVAILABLE_BACKOFF_MS
        if (cached) return { ...cached.value, source: 'stale-cache' }
      }
      else if (error) {
        summaryFailures.set(cacheKey, {
          error,
          retryAfter: Date.now() + SUMMARY_FAILURE_BACKOFF_MS
        })
        if (cached) return { ...cached.value, source: 'stale-cache' }
        throw error
      }
    }

    try {
      const value = await fetchSummaryFallback(from, to)
      summaryCache.set(cacheKey, { value, fetchedAt: Date.now() })
      summaryFailures.delete(cacheKey)
      return value
    } catch (error) {
      summaryFailures.set(cacheKey, {
        error,
        retryAfter: Date.now() + SUMMARY_FAILURE_BACKOFF_MS
      })
      if (cached) return { ...cached.value, source: 'stale-cache' }
      throw error
    }
  })().finally(() => {
    summaryInFlight.delete(cacheKey)
  })

  summaryInFlight.set(cacheKey, request)
  return request
}
