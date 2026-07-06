import { supabase } from '../supabase'

let rpcUnavailable = false

const FINAL_STAGES = new Set(['пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування', 'completed'])

const fetchSummaryFallback = async (from = null, to = null) => {
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
    if (from) query = query.gte('completed_at', from)
    if (to) query = query.lte('completed_at', to)

    const { data, error } = await query
    if (error) throw error
    for (const row of data || []) {
      historyCount += 1
      totalScrap += Number(row.scrap_qty) || 0
      if (FINAL_STAGES.has(String(row.stage_name || '').toLowerCase().trim())) {
        totalProduced += Number(row.qty_completed) || 0
      }
    }
    if (!data || data.length < pageSize) break
  }

  return { totalProduced, totalScrap, historyCount, source: 'paginated-fallback' }
}

export const fetchProductionSummary = async (from = null, to = null) => {
  if (!rpcUnavailable) {
    const { data, error } = await supabase.rpc('mes_production_summary', { p_from: from, p_to: to })
    if (!error && data) return { ...data, source: 'database' }
    if (error?.code === 'PGRST202' || error?.code === '42883') rpcUnavailable = true
  }
  return fetchSummaryFallback(from, to)
}