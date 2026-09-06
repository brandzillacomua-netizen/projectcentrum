import { supabase } from '../../supabase.js'
import { isFulfillmentRoute } from '../../services/fulfillmentQueueService.js'

export {
  fetchFulfillmentTasks,
  fetchMissingOrdersForTasks,
  isFulfillmentRoute
} from '../../services/fulfillmentQueueService.js'

export { fetchProductionSummary } from '../../services/statisticsService.js'

export const CACHE_KEY = 'MES_APP_CACHE_V13'
export const LEGACY_CACHE_KEYS = ['MES_APP_CACHE_V1', 'MES_APP_CACHE_V2', 'MES_APP_CACHE_V3', 'MES_APP_CACHE_V4', 'MES_APP_CACHE_V5', 'MES_APP_CACHE_V6', 'MES_APP_CACHE_V7', 'MES_APP_CACHE_V8', 'MES_APP_CACHE_V9', 'MES_APP_CACHE_V10', 'MES_APP_CACHE_V11', 'MES_APP_CACHE_V12']

export const F10_NOM_IDS = new Set([
  '5ecf63e5-802d-4f98-8291-aad9a52bfaa4',
  '50947afc-4e40-4165-a682-780275d5feda',
  '343417a7-4a5c-4e31-8f44-18abb41defec',
  'b77e0883-0af2-40a4-a834-a1e47b6570da'
])

export const isF10Card = (card) => {
  if (!card) return false
  if (F10_NOM_IDS.has(String(card.nomenclature_id))) return true
  const info = JSON.stringify(card)
  if (info.includes('Київ К-ІП9/10/31/36/37-9-10-11') || info.includes('Київ К-ІП9-10-П-7-46')) return true
  return false
}

export const USER_CACHE_KEY = 'MES_SESSION_USER'  // Full user object for instant restore
export const TARGET_REFRESH_TTL_MS = 900
export const TARGET_REFRESH_TTL_BY_TABLE = Object.freeze({
  nomenclatures: 10 * 60 * 1000,
  bom_items: 10 * 60 * 1000,
  company_structure: 30 * 60 * 1000,
  company_positions: 30 * 60 * 1000,
  machine_operations: 15 * 60 * 1000,
  work_card_flow_totals: 5 * 60 * 1000,
  work_card_scrap_totals: 60 * 1000
})
export const INITIAL_FETCH_JITTER_MS = 8000
export const INITIAL_FETCH_RETRY_BASE_MS = 30 * 1000
export const INITIAL_FETCH_RETRY_JITTER_MS = 30 * 1000
export const ROUTE_ENTRY_REFRESH_TTL_MS = 60 * 1000
export const ROUTE_ENTRY_JITTER_MS = 1500
export const VISIBILITY_REFRESH_COOLDOWN_MS = 2 * 60 * 1000
export const VISIBILITY_REFRESH_JITTER_MS = 5000

export const OPERATOR_REALTIME_ROUTES = new Set([
  '/operator',
  '/prep-terminal',
  '/shop1',
  '/tumbling-terminal',
  '/reception-terminal',
  '/sorting-terminal',
  '/shop2-terminal',
  '/pressing-terminal',
  '/painting-terminal',
  '/packaging'
])

export const WAREHOUSE_REALTIME_ROUTES = new Set([
  '/warehouse',
  '/warehouse-boxes',
  '/supply',
  '/procurement'
])

export const MANAGEMENT_REALTIME_ROUTES = new Set([
  '/tumbling-dashboard',
  '/shop1-foreman',
  '/preparation-dashboard',
  '/foreman-dashboard',
  '/foreman2'
])

export const FLOW_TOTALS_REALTIME_ROUTES = new Set([
  '/foreman-dashboard',
  '/foreman2'
])

export const ROUTE_DATA_PROFILES = Object.freeze({
  '/': ['orders', 'work_cards', 'material_requests', 'machines', 'machine_calls', 'tasks', 'management_tasks', 'company_positions', 'system_users'],
  '/dashboard': ['orders', 'tasks', 'inventory', 'work_cards', 'nomenclatures', 'bom_items', 'work_card_history'],
  '/foreman-dashboard': ['orders', 'tasks', 'inventory', 'work_cards', 'nomenclatures', 'bom_items', 'work_card_scrap_totals', 'work_card_flow_totals'],
  '/manager': ['orders', 'tasks', 'nomenclatures'],
  '/warehouse': ['inventory', 'material_requests', 'nomenclatures', 'reception_docs', 'orders', 'tasks', 'purchase_requests', 'machine_operations', 'work_cards', 'system_users'],
  '/warehouse-boxes': ['inventory', 'material_requests', 'nomenclatures', 'orders', 'tasks', 'machine_operations', 'work_cards'],
  '/cutter-restoration': [],
  '/master': ['orders', 'tasks', 'nomenclatures', 'bom_items', 'inventory', 'material_requests', 'machines', 'machine_calls', 'machine_operations'],
  '/foreman': ['orders', 'tasks', 'work_cards', 'nomenclatures', 'bom_items', 'inventory', 'material_requests', 'machines', 'machine_calls', 'machine_operations', 'work_card_scrap_totals'],
  '/foreman2': ['orders', 'tasks', 'work_cards', 'nomenclatures', 'bom_items', 'inventory', 'material_requests', 'machines', 'machine_calls', 'machine_operations', 'work_card_scrap_totals', 'work_card_flow_totals'],
  '/operator': ['work_cards', 'orders', 'nomenclatures', 'machines', 'system_users', 'machine_operations', 'tasks', 'inventory', 'work_card_history'],
  '/prep-terminal': ['tasks', 'nomenclatures', 'material_requests', 'inventory', 'orders', 'system_users'],
  '/preparation-dashboard': ['tasks', 'nomenclatures', 'material_requests', 'inventory', 'reception_docs', 'machine_operations', 'work_cards', 'orders'],
  '/shop1': ['work_cards', 'tasks', 'nomenclatures', 'inventory', 'orders', 'machines', 'system_users', 'machine_operations', 'material_requests', 'work_card_history'],
  '/shop1-foreman': ['system_users', 'company_positions', 'company_structure', 'work_cards', 'work_card_history', 'machines', 'nomenclatures', 'tasks', 'orders', 'bom_items', 'inventory', 'machine_operations'],
  '/tumbling-terminal': ['work_cards', 'nomenclatures', 'bom_items', 'orders', 'tasks', 'work_card_history', 'system_users'],
  '/tumbling-dashboard': ['work_cards', 'nomenclatures', 'bom_items', 'orders', 'tasks', 'work_card_history'],
  '/reception-terminal': ['work_cards', 'nomenclatures', 'system_users'],
  '/sorting-terminal': ['work_cards', 'nomenclatures', 'system_users'],
  '/shop2-card-gen': ['orders', 'tasks', 'work_cards', 'nomenclatures', 'bom_items', 'work_card_history'],
  '/shop2-terminal': ['work_cards', 'orders', 'nomenclatures', 'inventory', 'system_users', 'tasks', 'work_card_history', 'machines'],
  '/pressing-terminal': ['work_cards', 'nomenclatures', 'system_users'],
  '/painting-terminal': ['work_cards', 'nomenclatures', 'system_users'],
  '/packaging': ['orders', 'tasks', 'nomenclatures', 'bom_items', 'material_requests', 'inventory', 'system_users'],
  '/engineer': ['nomenclatures', 'bom_items', 'machines', 'machine_operations', 'tasks', 'orders', 'machine_calls'],
  '/director': ['tasks', 'orders', 'nomenclatures', 'material_requests', 'work_cards'],
  '/shipping': ['orders', 'tasks', 'nomenclatures', 'system_users'],
  '/supply': ['inventory', 'nomenclatures', 'reception_docs', 'purchase_requests', 'material_requests', 'tasks', 'system_users'],
  '/procurement': ['inventory', 'nomenclatures', 'reception_docs', 'purchase_requests', 'system_users'],
  '/nomenclature': ['nomenclatures', 'bom_items'],
  '/nomenclature-v2': [],
  '/machines': ['machines', 'work_cards', 'work_card_history', 'nomenclatures', 'orders', 'tasks', 'machine_calls'],
  '/analytics': ['tasks', 'orders', 'work_cards', 'work_card_history', 'nomenclatures'],
  '/brak': ['inventory', 'nomenclatures', 'work_cards', 'orders', 'machine_calls', 'machines', 'work_card_history', 'system_users', 'tasks'],
  '/tasks': ['management_tasks', 'task_projects', 'system_users', 'company_structure'],
  '/tasks/projects': ['management_tasks', 'task_projects', 'system_users', 'company_structure'],
  '/chat': ['system_users'],
  '/access': [],
  '/reports': ['inventory', 'system_users', 'work_card_history', 'tasks', 'orders', 'nomenclatures', 'reception_docs', 'material_requests'],
  '/settings': ['system_users', 'company_structure', 'company_positions', 'nomenclatures', 'bom_items', 'inventory']
})

export const PRODUCTION_SUMMARY_ROUTES = new Set([
  '/master',
  '/dashboard',
  '/foreman-dashboard',
  '/foreman2',
  '/analytics'
])

export const normalizeRoutePath = (pathname = '') => String(pathname).toLowerCase().replace(/\/+$/, '') || '/'

export const getRouteDataTables = (pathname = '') => {
  const normalized = normalizeRoutePath(pathname)
  return [...new Set(ROUTE_DATA_PROFILES[normalized] || [])]
}

export const getTaskDataProfileKey = (pathname = '') => {
  const normalized = normalizeRoutePath(pathname)
  return isFulfillmentRoute(normalized)
    ? `tasks:${normalized}`
    : 'tasks:operational'
}

export const FINAL_PRODUCTION_STAGES = new Set([
  'пакування/сгп',
  'прийомка',
  'склад бз',
  'сгп',
  'пакування',
  'completed'
])

export const productionHistoryContribution = (row) => ({
  produced: FINAL_PRODUCTION_STAGES.has(String(row?.stage_name || '').toLowerCase().trim())
    ? Number(row?.qty_completed) || 0
    : 0,
  scrap: Number(row?.scrap_qty) || 0
})

export const getRealtimeProfile = (pathname = '') => {
  const normalized = normalizeRoutePath(pathname)
  if (normalized === '/login' || /^\/machines\/[^/]+\/call$/.test(normalized)) return 'public'
  if (normalized === '/') return 'portal'
  if (normalized === '/settings') return 'settings'
  if (FLOW_TOTALS_REALTIME_ROUTES.has(normalized)) return 'flow-dashboard'
  if (MANAGEMENT_REALTIME_ROUTES.has(normalized)) return 'management'
  if (WAREHOUSE_REALTIME_ROUTES.has(normalized)) return 'warehouse'
  if (OPERATOR_REALTIME_ROUTES.has(normalized)) return 'operator'
  return 'management'
}

export const fallbackStructure = [
  { id: '1', name: 'Цех №1', type: 'shop' },
  { id: '2', name: 'Цех №2', type: 'shop' },
  { id: '3', name: 'Склад', type: 'warehouse' },
  { id: '4', name: 'Галтовка', type: 'tumbling' },
  { id: '5', name: 'Контроль браку', type: 'quality' },
  { id: '6', name: 'Керівництво', type: 'management' }
]

export const fallbackPositions = [
  { id: '1', name: 'Директор виробництва' },
  { id: '2', name: 'Начальник цеху' },
  { id: '3', name: 'Майстер цеху' },
  { id: '4', name: 'Майстер дільниці' },
  { id: '5', name: 'Оператор' },
  { id: '6', name: 'Галтовщик' },
  { id: '7', name: 'Пресувальник' },
  { id: '8', name: 'Маляр' },
  { id: '9', name: 'Слюсар' },
  { id: '10', name: 'Працівник складу' },
  { id: '11', name: 'Контроль браку' },
  { id: '12', name: 'Менеджер' },
  { id: '13', name: 'Інженер' },
  { id: '14', name: 'Адмін' }
]

export const loadFromCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch (e) {
    console.warn('Failed to load cache:', e)
    return {}
  }
}

export const PURGED_ORDER_NUMS = new Set(['14082026-01', '10082026-01', '260821-1'])
export const isPurgedOrderNum = (num) => PURGED_ORDER_NUMS.has(String(num || '').trim())

export const isPurgedTask = (task) => {
  if (!task) return false
  const orderNum = task.order_num || task.plan_snapshot?._prep_num || task.plan_snapshot?._metadata?.order_num
  if (orderNum && isPurgedOrderNum(orderNum)) return true
  const str = JSON.stringify(task)
  if (str.includes('14082026-01') || str.includes('10082026-01') || str.includes('260821-1')) return true
  return false
}

// Lazy cache getter — reads ONCE, returns a field or default
export const fromCache = (field, def) => () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return def
    const parsed = JSON.parse(cached)
    const val = parsed[field] ?? def
    if (Array.isArray(val)) {
      return val.filter(item => !isPurgedOrderNum(item?.order_num) && !isPurgedOrderNum(item?.plan_snapshot?._prep_num))
    }
    return val
  } catch { return def }
}

export const fetchActiveWorkCards = async () => {
  const pageSize = 500
  const allCards = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('work_cards')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return { data: null, error }
    allCards.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  const uniqueCards = Array.from(new Map(allCards.map(c => [String(c.id), c])).values())
  return { data: uniqueCards, error: null }
}

export const fetchAllRows = async (table, { orderBy = 'created_at', ascending = false, pageSize = 1000 } = {}) => {
  const allRows = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(orderBy, { ascending })
      .range(from, from + pageSize - 1)

    if (error) return { data: allRows.length > 0 ? allRows : null, error }
    const page = data || []
    allRows.push(...page)
    if (page.length < pageSize) break
  }

  const uniqueRows = Array.from(new Map(allRows.map(row => [String(row.id), row])).values())
  return { data: uniqueRows, error: null }
}

export const fetchOperationalMaterialRequests = async ({ completedLimit = 200 } = {}) => {
  const pageSize = 500
  const activeRows = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('material_requests')
      .select('*')
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return { data: null, error }
    const page = data || []
    activeRows.push(...page)
    if (page.length < pageSize) break
  }

  const { data: recentCompleted, error: completedError } = await supabase
    .from('material_requests')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(completedLimit)

  if (completedError) return { data: null, error: completedError }

  const rows = [...activeRows, ...(recentCompleted || [])]
  return {
    data: Array.from(new Map(rows.map(row => [String(row.id), row])).values())
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    error: null
  }
}

export const fetchWorkCardScrapTotals = async (taskIds = []) => {
  const scopedTaskIds = [...new Set((taskIds || []).filter(Boolean).map(String))]
  if (scopedTaskIds.length === 0) return { data: [], error: null }

  const pageSize = 1000
  const allRows = []

  for (let chunkStart = 0; chunkStart < scopedTaskIds.length; chunkStart += 20) {
    const taskChunk = scopedTaskIds.slice(chunkStart, chunkStart + 20)
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('work_card_scrap_totals')
        .select('*')
        .in('task_id', taskChunk)
        .range(from, from + pageSize - 1)

      if (error) return { data: null, error }
      const page = data || []
      allRows.push(...page)
      if (page.length < pageSize) break
    }
  }

  return {
    data: Array.from(new Map(allRows.map(row => [String(row.id), row])).values()),
    error: null
  }
}

export const fetchWorkCardFlowTotals = async (taskIds = []) => {
  const scopedTaskIds = [...new Set((taskIds || []).filter(Boolean).map(String))]
  if (scopedTaskIds.length === 0) return { data: [], error: null }

  const pageSize = 1000
  const allRows = []

  for (let chunkStart = 0; chunkStart < scopedTaskIds.length; chunkStart += 20) {
    const taskChunk = scopedTaskIds.slice(chunkStart, chunkStart + 20)
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from('work_card_flow_totals')
        .select('*')
        .in('task_id', taskChunk)
        .range(from, from + pageSize - 1)

      if (error) return { data: allRows.length > 0 ? allRows : null, error }
      const page = data || []
      allRows.push(...page)
      if (page.length < pageSize) break
    }
  }

  return {
    data: Array.from(new Map(allRows.map(row => [String(row.id), row])).values()),
    error: null
  }
}

export const OPERATIONAL_TASK_FIELDS = 'id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,batch_index,planned_deadline,machine_name,created_at,completed_at,plan_snapshot'

export const fetchOperationalTasks = async ({ daysCompleted = 7 } = {}) => {
  const recentCompletedCutoff = new Date(Date.now() - daysCompleted * 24 * 60 * 60 * 1000).toISOString()
  const pageSize = 500
  const rows = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('tasks')
      .select(OPERATIONAL_TASK_FIELDS)
      .or(`status.neq.completed,completed_at.gte.${recentCompletedCutoff}`)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return { data: null, error }
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return {
    data: Array.from(new Map(rows.map(row => [String(row.id), row])).values()),
    error: null
  }
}

export const fetchActiveTasksOnly = async () => {
  const pageSize = 500
  const rows = []

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('tasks')
      .select(OPERATIONAL_TASK_FIELDS)
      .neq('status', 'completed')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + pageSize - 1)

    if (error) return { data: null, error }
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) break
  }

  return {
    data: Array.from(new Map(rows.map(row => [String(row.id), row])).values()),
    error: null
  }
}

export const fetchPendingMachineCalls = async () => {
  const pageSize = 500
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('machine_calls')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return { data: rows, error: null }
}

export const mergeTaskRows = (existing = [], incoming = []) => {
  if (!Array.isArray(incoming)) return (existing || []).filter(t => !isPurgedTask(t))
  const existingMap = new Map((existing || []).map(item => [String(item.id), item]))
  const result = incoming.map(item => {
    const cached = existingMap.get(String(item.id))
    return {
      ...cached,
      ...item,
      plan_snapshot: item.plan_snapshot || cached?.plan_snapshot || null
    }
  }).filter(t => !isPurgedTask(t))
  return result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

export const mergeOrderRows = (existing = [], incoming = []) => {
  if (!Array.isArray(incoming)) return existing
  const existingMap = new Map((existing || []).map(item => [String(item.id), item]))
  const result = incoming.map(item => {
    if (!item?.id) return item
    const cached = existingMap.get(String(item.id))
    return { ...cached, ...item }
  }).filter(o => o && !isPurgedOrderNum(o?.order_num))
  return result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

export const isTaskInFulfillmentSlice = (task, pathname) => {
  const metadata = task?.plan_snapshot?._metadata || {}
  if (pathname === '/packaging') {
    return metadata.is_packaged === true
  }
  if (pathname === '/shipping') {
    return metadata.is_packaged === true || metadata.is_shipped === true
  }
  return false
}

export const reconcileFulfillmentTaskRows = (existing = [], incoming = [], pathname = '') => {
  if (!incoming || incoming.length === 0) return existing
  const incomingIds = new Set(incoming.map(task => String(task?.id || '')).filter(Boolean))
  const retained = existing.filter(task => (
    !isTaskInFulfillmentSlice(task, pathname) || incomingIds.has(String(task?.id || ''))
  ))
  return mergeTaskRows(retained, incoming)
}
