import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, isLocalWrite } from '../supabase'
import { sendPushToUsers } from '../services/pushService'
import { getIndexedCache, setIndexedCache, removeIndexedCache } from '../services/indexedDbCache'
import { fetchProductionSummary } from '../services/statisticsService'
import { fetchFulfillmentTasks, fetchMissingOrdersForTasks, isFulfillmentRoute } from '../services/fulfillmentQueueService'

const CACHE_KEY = 'MES_APP_CACHE_V2'
const LEGACY_CACHE_KEYS = ['MES_APP_CACHE_V1']
const USER_CACHE_KEY = 'MES_SESSION_USER'  // Full user object for instant restore
const TARGET_REFRESH_TTL_MS = 900
const TARGET_REFRESH_TTL_BY_TABLE = Object.freeze({
  work_card_flow_totals: 5 * 60 * 1000,
  work_card_scrap_totals: 60 * 1000
})
const INITIAL_FETCH_JITTER_MS = 8000
const INITIAL_FETCH_RETRY_BASE_MS = 30 * 1000
const INITIAL_FETCH_RETRY_JITTER_MS = 30 * 1000
const ROUTE_ENTRY_REFRESH_TTL_MS = 60 * 1000
const ROUTE_ENTRY_JITTER_MS = 1500
const VISIBILITY_REFRESH_COOLDOWN_MS = 2 * 60 * 1000
const VISIBILITY_REFRESH_JITTER_MS = 5000

const OPERATOR_REALTIME_ROUTES = new Set([
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

const WAREHOUSE_REALTIME_ROUTES = new Set([
  '/warehouse',
  '/warehouse-boxes',
  '/supply',
  '/procurement'
])

const MANAGEMENT_REALTIME_ROUTES = new Set([
  '/tumbling-dashboard',
  '/shop1-foreman',
  '/preparation-dashboard',
  '/foreman-dashboard',
  '/foreman2'
])

const FLOW_TOTALS_REALTIME_ROUTES = new Set([
  '/foreman-dashboard',
  '/foreman2'
])

// Each screen receives only the data it actually renders. Users always land
// on `/`, so keeping the portal profile tiny is what prevents a login/restart
// wave from turning into the former 20-table bootstrap on every device.
const ROUTE_DATA_PROFILES = Object.freeze({
  '/': ['management_tasks', 'company_positions', 'system_users'],
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
  '/shop2': ['orders', 'tasks', 'work_cards', 'nomenclatures', 'bom_items', 'work_card_history'],
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
  '/settings': ['system_users', 'company_structure', 'company_positions', 'nomenclatures', 'bom_items', 'inventory'],
  '/simulator': ['nomenclatures', 'bom_items']
})

const PRODUCTION_SUMMARY_ROUTES = new Set([
  '/master',
  '/dashboard',
  '/foreman-dashboard',
  '/foreman2',
  '/analytics'
])

const normalizeRoutePath = (pathname = '') => String(pathname).toLowerCase().replace(/\/+$/, '') || '/'

const getRouteDataTables = (pathname = '') => {
  const normalized = normalizeRoutePath(pathname)
  return [...new Set(ROUTE_DATA_PROFILES[normalized] || [])]
}

const getTaskDataProfileKey = (pathname = '') => {
  const normalized = normalizeRoutePath(pathname)
  return isFulfillmentRoute(normalized)
    ? `tasks:${normalized}`
    : 'tasks:operational'
}

const FINAL_PRODUCTION_STAGES = new Set([
  'пакування/сгп',
  'прийомка',
  'склад бз',
  'сгп',
  'пакування',
  'completed'
])

const productionHistoryContribution = (row) => ({
  produced: FINAL_PRODUCTION_STAGES.has(String(row?.stage_name || '').toLowerCase().trim())
    ? Number(row?.qty_completed) || 0
    : 0,
  scrap: Number(row?.scrap_qty) || 0
})

const getRealtimeProfile = (pathname = '') => {
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

const fallbackStructure = [
  { id: '1', name: 'Цех №1', type: 'shop' },
  { id: '2', name: 'Цех №2', type: 'shop' },
  { id: '3', name: 'Склад', type: 'warehouse' },
  { id: '4', name: 'Галтовка', type: 'tumbling' },
  { id: '5', name: 'Контроль браку', type: 'quality' },
  { id: '6', name: 'Керівництво', type: 'management' }
]

const fallbackPositions = [
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

const loadFromCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch (e) {
    console.warn('Failed to load cache:', e)
    return {}
  }
}

// Lazy cache getter — reads ONCE, returns a field or default
const fromCache = (field, def) => () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return def
    const parsed = JSON.parse(cached)
    return parsed[field] ?? def
  } catch { return def }
}

const fetchActiveWorkCards = async () => {
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

// Supabase/PostgREST commonly caps one response at 1000 rows. Fetch every
// page explicitly so historical rows are never dropped from application state
// (and consequently from the IndexedDB cache).
const fetchAllRows = async (table, { orderBy = 'created_at', ascending = false, pageSize = 1000 } = {}) => {
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

const fetchOperationalMaterialRequests = async () => {
  const pageSize = 500
  const activeRows = []

  // Every unresolved request must remain visible even when completed history
  // grows beyond PostgREST's response cap.
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

  // A bounded completed slice preserves current packaging/report previews
  // without downloading the entire historical request table into every tab.
  const { data: recentCompleted, error: completedError } = await supabase
    .from('material_requests')
    .select('*')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(5000)

  if (completedError) return { data: null, error: completedError }

  const rows = [...activeRows, ...(recentCompleted || [])]
  return {
    data: Array.from(new Map(rows.map(row => [String(row.id), row])).values())
      .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    error: null
  }
}

const fetchWorkCardScrapTotals = async (taskIds = []) => {
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

const fetchWorkCardFlowTotals = async (taskIds = []) => {
  const scopedTaskIds = [...new Set((taskIds || []).filter(Boolean).map(String))]
  if (scopedTaskIds.length === 0) return { data: [], error: null }

  const pageSize = 1000
  const allRows = []

  // Keep PostgREST URLs bounded while still supporting more than one shop's
  // active tasks. The result is de-duplicated after all task chunks are read.
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

const OPERATIONAL_TASK_FIELDS = 'id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,batch_index,planned_deadline,machine_name,created_at,completed_at,plan_snapshot'

const fetchOperationalTasks = async () => {
  const recentCompletedCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const pageSize = 500
  const rows = []

  // A single unbounded response was both truncated by PostgREST's row cap and
  // large enough to fail during database pressure. Serial page requests are
  // kept behind the per-tab read semaphore in supabase.js.
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

const fetchActiveTasksOnly = async () => {
  const pageSize = 500
  const rows = []

  // Fulfillment screens get their completed/open queue from the bounded RPC.
  // The shared state still needs every unfinished task for notifications and
  // instant route changes, but repeating the 30-day completed slice here would
  // recreate most of the read pressure the queue is designed to remove.
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

const fetchPendingMachineCalls = async () => {
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

const mergeTaskRows = (existing = [], incoming = []) => {
  const merged = new Map(existing.map(item => [String(item.id), item]))
  incoming.forEach(item => {
    const cached = merged.get(String(item.id))
    merged.set(String(item.id), {
      ...cached,
      ...item,
      plan_snapshot: item.plan_snapshot || cached?.plan_snapshot || null
    })
  })
  return Array.from(merged.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

const mergeOrderRows = (existing = [], incoming = []) => {
  const merged = new Map(existing.map(item => [String(item.id), item]))
  incoming.forEach(item => {
    if (!item?.id) return
    const cached = merged.get(String(item.id))
    merged.set(String(item.id), { ...cached, ...item })
  })
  return Array.from(merged.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
}

const isTaskInFulfillmentSlice = (task, pathname) => {
  const metadata = task?.plan_snapshot?._metadata || {}
  if (pathname === '/packaging') {
    return task?.status === 'completed' || metadata.is_packaged === true
  }
  if (pathname === '/shipping') {
    return metadata.is_packaged === true || metadata.is_shipped === true
  }
  return false
}

const reconcileFulfillmentTaskRows = (existing = [], incoming = [], pathname = '') => {
  const incomingIds = new Set(incoming.map(task => String(task?.id || '')).filter(Boolean))
  const retained = existing.filter(task => (
    !isTaskInFulfillmentSlice(task, pathname) || incomingIds.has(String(task?.id || ''))
  ))
  return mergeTaskRows(retained, incoming)
}
export function useData() {
  const location = useLocation()
  const path = location.pathname
  const normalizedPath = useMemo(() => normalizeRoutePath(path), [path])
  const realtimeProfile = useMemo(() => getRealtimeProfile(path), [path])
  const routeDataTables = useMemo(() => getRouteDataTables(path), [path])
  const routeDataTableKey = routeDataTables.join('|')
  const routeHasTable = (tableName) => routeDataTables.includes(tableName)
  const needsProductionSummary = PRODUCTION_SUMMARY_ROUTES.has(normalizedPath)
  const isPublicDataRoute = realtimeProfile === 'public'

  // ── Lazy initialisers: localStorage is parsed ONCE per mount, not on every render ──
  const [orders, setOrders] = useState(fromCache('orders', []))
  const [customers, setCustomers] = useState(fromCache('customers', []))
  const [inventory, setInventory] = useState(fromCache('inventory', []))
  const [tasks, setTasksState] = useState(fromCache('tasks', []))
  const [managementTasks, setManagementTasks] = useState(fromCache('managementTasks', []))
  const [taskProjects, setTaskProjects] = useState(fromCache('taskProjects', []))
  const [requests, setRequests] = useState(fromCache('requests', []))
  const [nomenclatures, setNomenclatures] = useState(fromCache('nomenclatures', []))
  const [bomItems, setBomItems] = useState(fromCache('bomItems', []))
  const [receptionDocs, setReceptionDocs] = useState(fromCache('receptionDocs', []))
  const [purchaseRequests, setPurchaseRequests] = useState(fromCache('purchaseRequests', []))
  const [workCards, setWorkCards] = useState(fromCache('workCards', []))
  const [workCardHistory, setWorkCardHistory] = useState(fromCache('workCardHistory', []))
  const [workCardScrapTotals, setWorkCardScrapTotals] = useState(fromCache('workCardScrapTotals', []))
  // Large dashboard projection: never hydrate globally from the general cache.
  const [workCardFlowTotals, setWorkCardFlowTotals] = useState(() => [])
  const [machines, setMachines] = useState(fromCache('machines', []))
  const [systemUsers, setSystemUsers] = useState(fromCache('systemUsers', []))
  const [machineOperations, setMachineOperations] = useState(fromCache('machineOperations', []))
  const [machineCalls, setMachineCalls] = useState(fromCache('machineCalls', []))
  const [accessLogs, setAccessLogs] = useState(() => [])
  const [fortnetUrl, setFortnetUrl] = useState(localStorage.getItem('FORTNET_API_URL') || 'http://192.168.1.100:8090')
  const [companyStructure, setCompanyStructure] = useState(fromCache('companyStructure', fallbackStructure))
  const [companyPositions, setCompanyPositions] = useState(fromCache('companyPositions', fallbackPositions))


  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const cached = localStorage.getItem(USER_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        const token = localStorage.getItem('BACKEND_TOKEN')
        return { ...parsed, token }
      }
    } catch (e) {
      console.warn('Failed to parse cached user:', e)
    }
    return null
  })
  // sessionLoading = false immediately if user cache exists (portal shows without any network wait)
  // sessionLoading = true only if login key exists but no cached user object (forces DB verify before showing portal)
  const [sessionLoading, setSessionLoading] = useState(() => {
    const hasLogin = !!localStorage.getItem('MES_SESSION_LOGIN')
    const hasCache = !!localStorage.getItem('MES_SESSION_USER')
    return hasLogin && !hasCache  // Only block UI if we have no cached user to show immediately
  })

  const [maintenanceCheckEnabled, setMaintenanceCheckEnabled] = useState(() => {
    return localStorage.getItem('maintenance_check_enabled') === 'true'
  })

  const updateMaintenanceCheckEnabled = async (value) => {
    setMaintenanceCheckEnabled(value)
    localStorage.setItem('maintenance_check_enabled', String(value))
    try {
      await supabase.from('system_configs').upsert({
        key: 'maintenance_check_enabled',
        value: { enabled: value }
      })
    } catch (e) {
      console.warn('Failed to save to system_configs in DB:', e)
    }
  }

  useEffect(() => {
    if (!currentUser?.id) return undefined

    supabase.from('system_configs').select('*').eq('key', 'maintenance_check_enabled').maybeSingle()
      .then(({ data }) => {
        if (data && data.value) {
          const val = data.value.enabled === true
          setMaintenanceCheckEnabled(val)
          localStorage.setItem('maintenance_check_enabled', String(val))
        }
      })
      .catch(e => {
        console.warn('system_configs table not created yet or inaccessible:', e)
      })
  }, [currentUser?.id])

  const [loading, setLoading] = useState(false)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const [serverProductionData, setServerProductionData] = useState(null)

  const fullFetchInFlightRef = useRef(null)
  const currentUserIdRef = useRef(currentUser?.id || null)
  const initialFetchCompletedUserIdRef = useRef(null)
  const initialFetchScheduleRef = useRef({ userId: null, notBefore: 0 })
  const productionSummaryInFlightRef = useRef(null)
  const moduleLoadInFlightRef = useRef({})
  const targetRefreshInFlightRef = useRef({})
  const targetRefreshLastRef = useRef({})
  const nomenclaturesLoadedRef = useRef(false)
  const bomItemsLoadedRef = useRef(false)
  const nomenclaturesRef = useRef([])
  const bomItemsRef = useRef([])
  const ordersRef = useRef(orders)
  const tasksRef = useRef(tasks)
  const inventoryRef = useRef([])
  const workCardHistoryRef = useRef([])
  const receptionDocsRef = useRef([])
  const purchaseRequestsRef = useRef([])
  const companyStructureRef = useRef([])
  const companyPositionsRef = useRef([])
  const normalizedPathRef = useRef(normalizedPath)
  const setTasks = useCallback((nextOrUpdater) => {
    const nextTasks = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(tasksRef.current)
      : nextOrUpdater
    tasksRef.current = nextTasks
    setTasksState(nextTasks)
  }, [currentUser?.id])

  currentUserIdRef.current = currentUser?.id || null
  normalizedPathRef.current = normalizedPath
  nomenclaturesRef.current = nomenclatures
  bomItemsRef.current = bomItems
  ordersRef.current = orders
  tasksRef.current = tasks
  inventoryRef.current = inventory
  workCardHistoryRef.current = workCardHistory
  receptionDocsRef.current = receptionDocs
  purchaseRequestsRef.current = purchaseRequests
  companyStructureRef.current = companyStructure
  companyPositionsRef.current = companyPositions

  const getInitialFetchDelayMs = () => {
    if (!currentUser?.id) return 0
    if (initialFetchScheduleRef.current.userId !== currentUser.id) {
      initialFetchScheduleRef.current = {
        userId: currentUser.id,
        notBefore: Date.now() + Math.floor(Math.random() * (INITIAL_FETCH_JITTER_MS + 1))
      }
    }
    return Math.max(0, initialFetchScheduleRef.current.notBefore - Date.now())
  }

  const fetchTasksForCurrentRoute = async () => {
    const profileKey = getTaskDataProfileKey(normalizedPath)
    if (!isFulfillmentRoute(normalizedPath)) {
      const result = await fetchOperationalTasks()
      return { ...result, profileKey }
    }

    const fulfillmentResult = await fetchFulfillmentTasks(supabase, normalizedPath)
    if (fulfillmentResult.error) return fulfillmentResult

    // Keep the shared tasks state complete for global notifications and quick
    // navigation without repeating the normal 30-day completed-history read.
    // The RPC is authoritative for this route's completed queue/archive, while
    // this query contributes every unfinished operational task.
    const operationalResult = await fetchActiveTasksOnly()
    if (operationalResult.error) return operationalResult

    return {
      data: mergeTaskRows(operationalResult.data || [], fulfillmentResult.data || []),
      error: null,
      source: fulfillmentResult.source,
      profileKey
    }
  }

  const getTargetRefreshKey = (tableName) => {
    if (tableName !== 'tasks') return tableName
    return getTaskDataProfileKey(normalizedPath)
  }

  const hydrateOrdersForTaskRows = async (taskRows, knownOrders = ordersRef.current) => {
    if (!isFulfillmentRoute(normalizedPath) || !Array.isArray(taskRows) || taskRows.length === 0) {
      return { data: [], error: null }
    }

    const result = await fetchMissingOrdersForTasks(supabase, taskRows, knownOrders)
    if (result.data?.length) {
      setOrders(prev => mergeOrderRows(prev, result.data))
    }
    return result
  }

  useEffect(() => {
    let cancelled = false
    LEGACY_CACHE_KEYS.forEach(cacheKey => {
      try { localStorage.removeItem(cacheKey) } catch { /* ignore unavailable storage */ }
      removeIndexedCache(cacheKey).catch(() => {})
    })
    getIndexedCache(CACHE_KEY).then(cached => {
      if (cancelled || !cached) return
      const restore = (setter, field) => setter(prev => Array.isArray(prev) && prev.length > 0 ? prev : (cached[field] ?? prev))
      restore(setOrders, 'orders')
      restore(setCustomers, 'customers')
      restore(setInventory, 'inventory')
      setTasks(prev => mergeTaskRows(prev, cached.tasks || []))
      restore(setManagementTasks, 'managementTasks')
      restore(setTaskProjects, 'taskProjects')
      restore(setRequests, 'requests')
      restore(setNomenclatures, 'nomenclatures')
      restore(setBomItems, 'bomItems')
      restore(setReceptionDocs, 'receptionDocs')
      restore(setPurchaseRequests, 'purchaseRequests')
      restore(setWorkCards, 'workCards')
      restore(setWorkCardHistory, 'workCardHistory')
      restore(setWorkCardScrapTotals, 'workCardScrapTotals')
      restore(setMachines, 'machines')
      restore(setSystemUsers, 'systemUsers')
      restore(setMachineOperations, 'machineOperations')
      restore(setMachineCalls, 'machineCalls')
      restore(setCompanyStructure, 'companyStructure')
      restore(setCompanyPositions, 'companyPositions')
    }).catch(error => console.warn('Failed to restore IndexedDB cache:', error))
    return () => { cancelled = true }
  }, [])

  const PAGE_SIZE = 20

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x').replace(/[іi]/g, 'i').replace(/[уy]/g, 'y')
    .replace(/[кk]/g, 'k').replace(/[мm]/g, 'm').replace(/[нn]/g, 'n')
    .replace(/[вv]/g, 'v').replace(/[и]/g, 'y').replace(/\s/g, '')

  const fetchOrders = async (page = 0, append = false, options = {}) => {
    const { searchQuery, dateRange } = options
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })

    if (searchQuery) query = query.or(`order_num.ilike.%${searchQuery}%,customer.ilike.%${searchQuery}%`)

    if (dateRange && dateRange !== 'all') {
      const now = new Date()
      let gteDate = null
      if (dateRange === 'today') gteDate = new Date(now.setHours(0, 0, 0, 0))
      else if (dateRange === 'week') gteDate = new Date(now.setDate(now.getDate() - 7))
      else if (dateRange === 'month') gteDate = new Date(now.setMonth(now.getMonth() - 1))
      else if (dateRange === 'quarter') gteDate = new Date(now.setMonth(now.getMonth() - 3))
      if (gteDate) query = query.gte('created_at', gteDate.toISOString())
    }

    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE - 1
    const { data, error } = await query.range(start, end)
    if (error) { console.error('Fetch orders error:', error); return }

    if (append) {
      setOrders(prev => {
        const existingIds = new Set(prev.map(o => o.id))
        const newData = (data || []).filter(o => !existingIds.has(o.id))
        return [...prev, ...newData]
      })
    } else { setOrders(data || []) }
    setHasMoreOrders((data || []).length === PAGE_SIZE)
  }

  // ── LEVEL 1: Critical data only — loads in ~300ms, shows portal immediately ──
  const fetchCritical = async () => {
    if (fullFetchInFlightRef.current) return fullFetchInFlightRef.current

    const request = (async () => {
      setLoading(true)
      let criticalCoreSucceeded = false
      try {
        const needsTable = (tableName) => routeDataTables.includes(tableName)
        const skippedTable = () => Promise.resolve({ data: null, error: null })
        const [
        { data: su },
        { data: mc },
        { data: mt },
        { data: tp },
        { data: c },
        { data: latest, error: oErr },
        { data: t, profileKey: taskProfileKey },
        { data: n },
        { data: b },
        { data: wc },
        structRes,
        posRes,
        { data: inv },
        { data: req },
        { data: rec },
        { data: pr },
        { data: wch },
        scrapTotalsRes,
        { data: mo },
        { data: mCalls }
        ] = await Promise.all([
        // Users & machines — needed for portal access filtering
        needsTable('system_users') ? supabase.from('system_users').select('id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar, last_seen, shift_calendar').order('login') : skippedTable(),
        needsTable('machines') ? supabase.from('machines').select('*').order('name') : skippedTable(),
        // Kanban badge counter
        needsTable('management_tasks') ? supabase.from('management_tasks').select('*').neq('status', 'done').order('created_at', { ascending: false }) : skippedTable(),
        needsTable('task_projects') ? supabase.from('task_projects').select('*').order('created_at', { ascending: false }) : skippedTable(),
        // Customers for manager
        needsTable('customers') ? supabase.from('customers').select('id,name,official_name').limit(50).order('name') : skippedTable(),
        // Latest orders WITH order_items — needed by Master, Foreman, Director for naryad creation
        needsTable('orders') ? supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 99) : skippedTable(),
        // Active tasks WITHOUT nested order JOIN — order data is already in orders state
        needsTable('tasks') ? fetchTasksForCurrentRoute() : skippedTable(),
        // Nomenclatures & BOM needed for naryad creation
        !needsTable('nomenclatures') ? skippedTable() : nomenclaturesLoadedRef.current ? Promise.resolve({ data: nomenclaturesRef.current }) : supabase.from('nomenclatures').select('*').limit(2000).then(res => { if (!res.error && Array.isArray(res.data)) nomenclaturesLoadedRef.current = true; return res; }),
        !needsTable('bom_items') ? skippedTable() : bomItemsLoadedRef.current ? Promise.resolve({ data: bomItemsRef.current }) : supabase.from('bom_items').select('*').limit(4000).then(res => { if (!res.error && Array.isArray(res.data)) bomItemsLoadedRef.current = true; return res; }),
        // Active (non-completed) work cards for real-time sync — completed are loaded separately per-task in ForemanWorkplace
        needsTable('work_cards') ? fetchActiveWorkCards() : skippedTable(),
        !needsTable('company_structure') ? skippedTable() : companyStructureRef.current.length > fallbackStructure.length ? Promise.resolve({ data: companyStructureRef.current }) : supabase.from('company_structure').select('*').order('name').then(res => res, () => ({ data: fallbackStructure, error: null })),
        !needsTable('company_positions') ? skippedTable() : companyPositionsRef.current.length > fallbackPositions.length ? Promise.resolve({ data: companyPositionsRef.current }) : supabase.from('company_positions').select('*').order('name').then(res => res, () => ({ data: fallbackPositions, error: null })),
        // Global Real-time Tables
        // IndexedDB is only an instant rendering layer. Always reconcile these
        // operational tables once after login because changes may have happened
        // while the browser (and its Realtime channel) was closed.
        needsTable('inventory') ? supabase.from('inventory').select('*').order('name').limit(3000) : skippedTable(),
        needsTable('material_requests') ? fetchOperationalMaterialRequests() : skippedTable(),
        needsTable('reception_docs') ? supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300) : skippedTable(),
        needsTable('purchase_requests') ? supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300) : skippedTable(),
        needsTable('work_card_history') ? supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(500) : skippedTable(),
        skippedTable(),
        needsTable('machine_operations') ? supabase.from('machine_operations').select('*') : skippedTable(),
        needsTable('machine_calls') ? fetchPendingMachineCalls() : skippedTable()
        ])

        const recentProjectionCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
        const projectionTaskIds = (t || tasksRef.current || [])
          .filter(task => task.status !== 'completed' || new Date(task.completed_at || task.updated_at || 0).getTime() > recentProjectionCutoff)
          .map(task => task.id)
          .filter(Boolean)
        const scopedScrapTotalsRes = needsTable('work_card_scrap_totals')
          ? await fetchWorkCardScrapTotals(projectionTaskIds)
          : scrapTotalsRes

        const taskProfileIsCurrent = !taskProfileKey || taskProfileKey === getTaskDataProfileKey(normalizedPathRef.current)
        const currentTaskRows = taskProfileIsCurrent ? t : null
        let fulfillmentOrders = []
        let fulfillmentHydrationSucceeded = true
        if (taskProfileIsCurrent && isFulfillmentRoute(normalizedPath) && Array.isArray(t)) {
          const hydrationResult = await fetchMissingOrdersForTasks(
            supabase,
            t,
            [...ordersRef.current, ...(latest || [])]
          )
          fulfillmentOrders = hydrationResult.data || []
          if (hydrationResult.error) {
            fulfillmentHydrationSucceeded = false
            console.warn('Fulfillment order hydration failed:', hydrationResult.error)
          }
        }

        // A module may request one of these tables while the initial bootstrap
        // is still running. Remember only the queries that actually succeeded:
        // the module request can then skip a duplicate read, while a transiently
        // failed non-core query is retried below instead of being discarded.
        const bootstrapResults = [
          ['system_users', su],
          ['machines', mc],
          ['management_tasks', mt],
          ['task_projects', tp],
          ['customers', c],
          ['orders', oErr ? null : latest],
          ['tasks', fulfillmentHydrationSucceeded ? currentTaskRows : null],
          ['nomenclatures', n],
          ['bom_items', b],
          ['work_cards', wc],
          ['company_structure', structRes?.error ? null : structRes?.data],
          ['company_positions', posRes?.error ? null : posRes?.data],
          ['inventory', inv],
          ['material_requests', req],
          ['reception_docs', rec],
          ['purchase_requests', pr],
          ['work_card_history', wch],
          ['work_card_scrap_totals', scopedScrapTotalsRes?.error ? null : scopedScrapTotalsRes?.data],
          ['machine_operations', mo],
          ['machine_calls', mCalls]
        ]
        const bootstrapResultByTable = new Map(bootstrapResults)
        criticalCoreSucceeded = routeDataTables
          .filter(tableName => bootstrapResultByTable.has(tableName))
          .every(tableName => Array.isArray(bootstrapResultByTable.get(tableName)))
        const bootstrapCompletedAt = Date.now()
        bootstrapResults.forEach(([tableName, data]) => {
          if (Array.isArray(data)) targetRefreshLastRef.current[getTargetRefreshKey(tableName)] = bootstrapCompletedAt
        })

        if (su) setSystemUsers(su)
        if (mc) setMachines(mc)
        if (mt) setManagementTasks(mt)
        if (tp) setTaskProjects(tp)
        if (c) setCustomers(c)
        if (!oErr && latest) {
          setOrders(isFulfillmentRoute(normalizedPath)
            ? mergeOrderRows(latest, fulfillmentOrders)
            : latest)
        } else if (fulfillmentOrders.length > 0) {
          setOrders(prev => mergeOrderRows(prev, fulfillmentOrders))
        }
        if (currentTaskRows) {
          setTasks(prev => isFulfillmentRoute(normalizedPath)
            ? reconcileFulfillmentTaskRows(prev, currentTaskRows, normalizedPath)
            : mergeTaskRows(prev, currentTaskRows))
        }
        if (n) setNomenclatures(n)
        if (b) setBomItems(b)
        if (wc) setWorkCards(wc)
        if (inv) setInventory(inv)
        if (req) setRequests(req)
        if (rec) setReceptionDocs(rec)
        if (pr) setPurchaseRequests(pr)
        if (wch) setWorkCardHistory(wch)
        if (scopedScrapTotalsRes?.data) setWorkCardScrapTotals(scopedScrapTotalsRes.data)
        if (mo) setMachineOperations(mo)
        if (mCalls) setMachineCalls(mCalls)

        if (needsTable('company_structure')) {
          if (structRes && structRes.data && structRes.data.length > 0) {
            setCompanyStructure(structRes.data)
          } else {
            setCompanyStructure(fallbackStructure)
          }
        }
        if (needsTable('company_positions')) {
          if (posRes && posRes.data && posRes.data.length > 0) {
            setCompanyPositions(posRes.data)
          } else {
            setCompanyPositions(fallbackPositions)
          }
        }
      } catch (e) {
        console.error('fetchCritical error:', e)
      } finally {
        if (criticalCoreSucceeded && currentUser?.id && currentUserIdRef.current === currentUser.id) {
          initialFetchCompletedUserIdRef.current = currentUser.id
        }
        setLoading(false)
      }
    })()

    fullFetchInFlightRef.current = request
    try {
      return await request
    } finally {
      if (fullFetchInFlightRef.current === request) fullFetchInFlightRef.current = null
    }
  }

  // ── LEVEL 2: Full data — called lazily by modules that need it ────────────
  const fetchData = async (forceOrTargets = false) => {
    if (typeof forceOrTargets === 'string' || Array.isArray(forceOrTargets)) {
      let targets = [...new Set((Array.isArray(forceOrTargets) ? forceOrTargets : [forceOrTargets])
        .map(tableName => tableName === 'requests' ? 'material_requests' : tableName))]

      // Child module effects run before the provider's effect on mount. Wait for
      // the bootstrap first; successful tables receive a fresh TTL there, while
      // any requested table whose bootstrap query failed is retried below.
      if (currentUser?.id && initialFetchCompletedUserIdRef.current !== currentUser.id) {
        const requestedUserId = currentUser.id
        const delay = getInitialFetchDelayMs()
        if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay))
        if (currentUserIdRef.current !== requestedUserId) return
        await fetchCritical()
        if (currentUserIdRef.current !== requestedUserId) return
      }

      await Promise.all(targets.map(tableName => {
        const now = Date.now()
        const refreshKey = getTargetRefreshKey(tableName)
        const inFlight = targetRefreshInFlightRef.current[refreshKey]
        if (inFlight) return inFlight

        const lastRun = targetRefreshLastRef.current[refreshKey] || 0
        const tableTtl = TARGET_REFRESH_TTL_BY_TABLE[tableName] || TARGET_REFRESH_TTL_MS
        if (now - lastRun < tableTtl) return Promise.resolve()

        const refreshPromise = refreshTable(tableName)
          .then(result => {
            targetRefreshLastRef.current[refreshKey] = Date.now()
            return result
          })
          .catch(error => console.warn(`refreshTable(${tableName}) failed:`, error))
          .finally(() => {
            delete targetRefreshInFlightRef.current[refreshKey]
          })

        targetRefreshInFlightRef.current[refreshKey] = refreshPromise
        return refreshPromise
      }))
      return
    }

    // A bare refresh is deliberately route-scoped. The old default refreshed
    // every operational table and was the main amplifier during recovery.
    if (forceOrTargets !== true) return fetchData(routeDataTables)

    // `true` used to mean "download every operational table" and made a
    // single legacy caller capable of recreating the outage. Preserve the
    // force semantics, but only for the current route's allow-list.
    routeDataTables.forEach(tableName => {
      targetRefreshLastRef.current[getTargetRefreshKey(tableName)] = 0
    })
    return fetchData(routeDataTables)
  }

  // ── On-demand loader for the big plan_snapshot data ─────────────────────────
  const fetchTaskPlanSnapshot = async (taskId) => {
    if (!taskId) return null
    try {
      // Find cached plan_snapshot first
      const cached = tasks.find(t => t.id === taskId)
      if (cached && cached.plan_snapshot) return cached.plan_snapshot

      const { data, error } = await supabase.from('tasks').select('plan_snapshot').eq('id', taskId).maybeSingle()
      if (error) throw error
      if (data && data.plan_snapshot) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, plan_snapshot: data.plan_snapshot } : t))
        return data.plan_snapshot
      }
    } catch (e) {
      console.error('Failed to fetch plan_snapshot for task:', taskId, e)
    }
    return null
  }

  const refreshProductionSummary = async (options = {}) => {
    if (productionSummaryInFlightRef.current) return productionSummaryInFlightRef.current

    const request = fetchProductionSummary(null, null, options)
      .then(summary => {
        setServerProductionData(summary)
        return summary
      })
      .catch(error => {
        // Keep the safe in-memory fallback based on the recent history slice.
        // In particular, never replace it with an expensive browser-side full scan.
        console.warn('Failed to refresh production summary:', error)
        return null
      })
      .finally(() => {
        if (productionSummaryInFlightRef.current === request) {
          productionSummaryInFlightRef.current = null
        }
      })

    productionSummaryInFlightRef.current = request
    return request
  }

  // ── Module-specific lazy loaders (called on module mount) ─────────────────
  const fetchModuleData = async (moduleName) => {
    const key = String(moduleName || '').toLowerCase()
    if (!key) return
    if (moduleLoadInFlightRef.current[key]) return moduleLoadInFlightRef.current[key]

    const request = (async () => {
      if (key === 'master') {
        // Keep the aggregate behind the staggered bootstrap instead of adding
        // another expensive query to the login burst.
        await fetchData(['orders', 'tasks', 'inventory', 'material_requests'])
        await refreshProductionSummary()
      } else if (key === 'foreman' && path.includes('foreman-dashboard')) {
        // This projection is large, so only the dashboard that consumes it
        // receives it. ForemanWorkplace keeps using its task-scoped history.
        await fetchData(['work_card_scrap_totals', 'work_card_flow_totals'])
      }
    })().finally(() => {
      delete moduleLoadInFlightRef.current[key]
    })

    moduleLoadInFlightRef.current[key] = request
    return request
  }

  const fetchHistoryRange = async (startDate, endDate) => {
    try {
      const pageSize = 500
      const rows = []
      for (let from = 0; ; from += pageSize) {
        let query = supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).range(from, from + pageSize - 1)
        if (startDate) query = query.gte('completed_at', startDate)
        if (endDate) query = query.lte('completed_at', endDate)
        const { data, error } = await query
        if (error) throw error
        rows.push(...(data || []))
        if (!data || data.length < pageSize) break
      }
      return rows
    } catch (e) {
      console.error('Failed to fetch complete history range:', e)
      return []
    }
  }

  const fetchTaskArchiveCards = async (taskId) => {
    try {
      const { data, error } = await supabase.from('work_cards').select('*').eq('task_id', taskId).order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    } catch (e) { return [] }
  }

  const refreshTable = async (tableName) => {
    try {
      const requireData = (result) => {
        if (result?.error) throw result.error
        return result?.data
      }

      if (tableName === 'work_cards') {
        const data = requireData(await fetchActiveWorkCards())
        if (data) setWorkCards(data)
      } else if (tableName === 'inventory') {
        const data = requireData(await supabase.from('inventory').select('*').order('name'))
        if (data) setInventory(data)
      } else if (tableName === 'tasks') {
        // No nested JOIN — tasks reference orders via order_id already in state
        const taskResult = await fetchTasksForCurrentRoute()
        const data = requireData(taskResult)
        if (taskResult.profileKey !== getTaskDataProfileKey(normalizedPathRef.current)) return
        if (data) {
          const hydrationResult = await hydrateOrdersForTaskRows(data)
          if (hydrationResult.error) throw hydrationResult.error
          setTasks(prev => {
            // Keep archived tasks already restored from IndexedDB. Some legacy
            // completed tasks have completed_at = null and are absent from the
            // rolling query; replacing state here made packaging lose their
            // freshly updated snapshots.
            return isFulfillmentRoute(normalizedPath)
              ? reconcileFulfillmentTaskRows(prev, data, normalizedPath)
              : mergeTaskRows(prev, data)
          })
        }
      } else if (tableName === 'orders') {
        // Include order_items so modules that need quantities work correctly
        const data = requireData(await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 50))
        if (data) setOrders(prev => {
          const next = [...prev]
          data.forEach(item => {
            const idx = next.findIndex(o => o.id === item.id)
            if (idx >= 0) next[idx] = item
            else next.unshift(item)
          })
          return next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        })
      } else if (tableName === 'machine_operations') {
        const data = requireData(await supabase.from('machine_operations').select('*'))
        if (data) setMachineOperations(data)
      } else if (tableName === 'machines') {
        const data = requireData(await supabase.from('machines').select('*').order('name'))
        if (data) setMachines(data)
      } else if (tableName === 'machine_calls') {
        const data = requireData(await fetchPendingMachineCalls())
        if (data) setMachineCalls(data)
      } else if (tableName === 'management_tasks') {
        const data = requireData(await supabase.from('management_tasks').select('*').neq('status', 'done').order('created_at', { ascending: false }))
        if (data) setManagementTasks(data)
      } else if (tableName === 'task_projects') {
        const data = requireData(await supabase.from('task_projects').select('*').order('created_at', { ascending: false }))
        if (data) setTaskProjects(data)
      } else if (tableName === 'system_users') {
        const data = requireData(await supabase
          .from('system_users')
          .select('id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar, last_seen, shift_calendar')
          .order('login'))
        if (data) setSystemUsers(data)
      } else if (tableName === 'company_structure') {
        const data = requireData(await supabase.from('company_structure').select('*').order('name'))
        if (data?.length) setCompanyStructure(data)
      } else if (tableName === 'company_positions') {
        const data = requireData(await supabase.from('company_positions').select('*').order('name'))
        if (data?.length) setCompanyPositions(data)
      } else if (tableName === 'nomenclatures') {
        const data = requireData(await supabase.from('nomenclatures').select('*').limit(2000))
        if (data) {
          setNomenclatures(data)
          nomenclaturesLoadedRef.current = true
        }
      } else if (tableName === 'bom_items') {
        const data = requireData(await supabase.from('bom_items').select('*').limit(4000))
        if (data) {
          setBomItems(data)
          bomItemsLoadedRef.current = true
        }
      } else if (tableName === 'customers') {
        const data = requireData(await supabase.from('customers').select('id,name,official_name').order('name').limit(500))
        if (data) setCustomers(data)
      } else if (tableName === 'purchase_requests') {
        const data = requireData(await supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300))
        if (data) setPurchaseRequests(data)
      } else if (tableName === 'reception_docs') {
        const data = requireData(await supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300))
        if (data) setReceptionDocs(data)
      } else if (tableName === 'material_requests' || tableName === 'requests') {
        const data = requireData(await fetchOperationalMaterialRequests())
        if (data) setRequests(data)
      } else if (tableName === 'work_card_history') {
        const data = requireData(await supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(500))
        if (data) {
          workCardHistoryRef.current = data
          setWorkCardHistory(data)
        }
      } else if (tableName === 'work_card_scrap_totals') {
        const recentCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
        const relevantTaskIds = tasksRef.current
          .filter(task => task.status !== 'completed' || new Date(task.completed_at || task.updated_at || 0).getTime() > recentCutoff)
          .map(task => task.id)
          .filter(Boolean)
        const data = requireData(await fetchWorkCardScrapTotals(relevantTaskIds))
        if (data) setWorkCardScrapTotals(data)
      } else if (tableName === 'work_card_flow_totals') {
        const recentCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
        const relevantTaskIds = tasksRef.current
          .filter(task => task.status !== 'completed' || new Date(task.completed_at || task.updated_at || 0).getTime() > recentCutoff)
          .map(task => task.id)
          .filter(Boolean)
        const data = requireData(await fetchWorkCardFlowTotals(relevantTaskIds))
        if (data) setWorkCardFlowTotals(data)
      } else {
        throw new Error(`Unsupported refresh table: ${tableName}`)
      }
    } catch (e) {
      console.error(`Error refreshing ${tableName}:`, e)
      throw e
    }
  }

  const productionData = useMemo(() => {
    const finalRecords = (workCardHistory || []).filter(h => FINAL_PRODUCTION_STAGES.has((h.stage_name || '').toLowerCase().trim()))
    const fallback = {
      totalProduced: finalRecords.reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0),
      totalScrap: (workCardHistory || []).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
    }
    return serverProductionData ? {
      totalProduced: Number(serverProductionData.totalProduced) || 0,
      totalScrap: Number(serverProductionData.totalScrap) || 0
    } : fallback
  }, [workCardHistory, serverProductionData])

  // --- PERSISTENCE (дебаунс 2с + тільки критичні поля щоб не блокувати UI) ---
  const cacheTimerRef = useRef(null)
  // Ref для завжди актуального списку користувачів в realtime-клозюрах
  const systemUsersRef = useRef([])
  useEffect(() => { systemUsersRef.current = systemUsers }, [systemUsers])
  const machinesRef = useRef([])
  useEffect(() => { machinesRef.current = machines }, [machines])
  useEffect(() => {
    if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current)
    cacheTimerRef.current = setTimeout(() => {
      try {
        const dataToCache = {
          orders,
          customers,
          tasks,
          managementTasks,
          taskProjects,
          requests,
          nomenclatures,
          bomItems,
          machines,
          systemUsers,
          machineOperations,
          machineCalls,
          companyStructure,
          companyPositions,
          workCards,
          inventory,
          receptionDocs,
          purchaseRequests,
          workCardHistory,
          workCardScrapTotals
        }
        setIndexedCache(CACHE_KEY, dataToCache)
          .then(() => localStorage.removeItem(CACHE_KEY))
          .catch(error => console.warn('IndexedDB cache write failed:', error))
      } catch (e) {
        console.warn('Cache write failed (quota?), clearing old cache...', e)
        try {
          removeIndexedCache(CACHE_KEY).catch(() => {})
        } catch (innerErr) { }
      }
    }, 2000) // Затримка 2с після останньої зміни
  }, [orders, customers, tasks, managementTasks, taskProjects, requests, nomenclatures, bomItems, machines, systemUsers, machineOperations, machineCalls, companyStructure, companyPositions, workCards, inventory, receptionDocs, purchaseRequests, workCardHistory, workCardScrapTotals])

  // --- REAL-TIME ---
  useEffect(() => {
    const needsPrimaryChannel = needsProductionSummary || [
      'work_cards',
      'tasks',
      'inventory',
      'work_card_history',
      'work_card_scrap_totals',
      'work_card_flow_totals'
    ].some(tableName => routeHasTable(tableName))
    if (!currentUser?.id || realtimeProfile === 'public' || !needsPrimaryChannel) return undefined

    const needsProductionHistory = routeHasTable('work_card_history') || needsProductionSummary
    const shouldLoadHistorySnapshot = routeHasTable('work_card_history')
    const needsScrapTotals = routeHasTable('work_card_scrap_totals')
    const needsFlowTotals = routeHasTable('work_card_flow_totals')
    let productionSummaryRefreshTimer = null

    const scheduleProductionSummaryRefresh = () => {
      if (!needsProductionSummary) return
      if (productionSummaryRefreshTimer) clearTimeout(productionSummaryRefreshTimer)
      productionSummaryRefreshTimer = setTimeout(() => {
        productionSummaryRefreshTimer = null
        refreshProductionSummary({ force: true })
          .catch(error => console.warn('Realtime production summary refresh failed:', error))
      }, 1500)
    }

    let activeChannel = supabase.channel('mes-global-updates')

    if (routeHasTable('work_cards')) {
      activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          if (payload.new.status === 'completed') {
            setWorkCards(prev => prev.filter(c => c.id !== payload.new.id))
          } else {
            setWorkCards(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
          }
        } else if (payload.eventType === 'INSERT') {
          if (payload.new.status !== 'completed') {
            setWorkCards(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])
          }
        } else if (payload.eventType === 'DELETE') {
          setWorkCards(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('tasks')) {
      activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setTasks(prev => {
            const exists = prev.some(t => t.id === payload.new.id);
            if (exists) {
              return prev.map(t => {
                if (t.id === payload.new.id) {
                  const merged = { ...t, ...payload.new };
                  if (t.plan_snapshot && !payload.new.plan_snapshot) {
                    merged.plan_snapshot = t.plan_snapshot;
                  }
                  return merged;
                }
                return t;
              });
            } else {
              return [payload.new, ...prev];
            }
          });
          const wasPackaged = payload.old?.plan_snapshot?._metadata?.is_packaged
          const isNowPackaged = payload.new?.plan_snapshot?._metadata?.is_packaged
          if (!wasPackaged && isNowPackaged) {
            if (isLocalWrite('tasks', payload.new)) {
              const notifyIds = (systemUsersRef.current || []).filter(u => {
                if (!u?.access_rights) return false
                const s = u.notification_settings || {}
                if (s.ready_to_ship === false) return false
                return u.access_rights.shipping || u.access_rights.director
              }).map(u => u.id)
              if (notifyIds.length > 0) {
                const packedBy = payload.new?.plan_snapshot?._metadata?.packaged_by || ''
                const batchIdx = payload.new?.batch_index || '1'
                sendPushToUsers(
                  notifyIds,
                  '🚚 Готово до відвантаження',
                  `Партія №${batchIdx}${packedBy ? ` (${packedBy})` : ''} запакована і очікує відвантаження`,
                  '/shipping',
                  { tag: `task-ready-to-ship-${payload.new.id}` }
                ).catch(() => { })
              }
            }
          }
        } else if (payload.eventType === 'INSERT') {
          setTasks(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('inventory')) {
      activeChannel = activeChannel.on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setInventory(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i))
        } else if (payload.eventType === 'INSERT') {
          setInventory(prev => prev.some(i => i.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setInventory(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
    }

    // Subscriptions for work_card_history are only needed for dashboards and manager modules, not operator terminals or warehouse
    if (needsProductionHistory) {
      activeChannel = activeChannel
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_card_history' }, (payload) => {
          const alreadyKnown = workCardHistoryRef.current.some(h => String(h.id) === String(payload.new.id))
          if (alreadyKnown) return

          const nextHistory = [payload.new, ...workCardHistoryRef.current].slice(0, 500)
          workCardHistoryRef.current = nextHistory
          setWorkCardHistory(nextHistory)

          // The database aggregate is loaded on demand, but once present it
          // must remain live without polling or another full-history scan.
          const contribution = productionHistoryContribution(payload.new)
          setServerProductionData(prev => prev ? {
            ...prev,
            totalProduced: (Number(prev.totalProduced) || 0) + contribution.produced,
            totalScrap: (Number(prev.totalScrap) || 0) + contribution.scrap,
            historyCount: Number.isFinite(Number(prev.historyCount))
              ? Number(prev.historyCount) + 1
              : prev.historyCount
          } : prev)
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_card_history' }, (payload) => {
          const previous = workCardHistoryRef.current.find(h => String(h.id) === String(payload.new.id))
          const nextHistory = workCardHistoryRef.current.map(h => h.id === payload.new.id ? { ...h, ...payload.new } : h)
          workCardHistoryRef.current = nextHistory
          setWorkCardHistory(nextHistory)

          if (previous) {
            const before = productionHistoryContribution(previous)
            const after = productionHistoryContribution({ ...previous, ...payload.new })
            setServerProductionData(prev => prev ? {
              ...prev,
              totalProduced: (Number(prev.totalProduced) || 0) + after.produced - before.produced,
              totalScrap: (Number(prev.totalScrap) || 0) + after.scrap - before.scrap
            } : prev)
          } else {
            // The local slice only contains the latest 500 rows, so an update
            // outside that slice cannot be reconciled safely with a delta.
            scheduleProductionSummaryRefresh()
          }
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'work_card_history' }, (payload) => {
          const deletedId = payload.old?.id
          if (deletedId != null) {
            const nextHistory = workCardHistoryRef.current.filter(h => String(h.id) !== String(deletedId))
            workCardHistoryRef.current = nextHistory
            setWorkCardHistory(nextHistory)
          }
          // DELETE payloads commonly contain only the primary key, so refresh
          // the aggregate once after a short burst instead of guessing a delta.
          scheduleProductionSummaryRefresh()
        })
    }

    if (needsScrapTotals) {
      activeChannel = activeChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_card_scrap_totals' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setWorkCardScrapTotals(prev => prev.some(row => row.id === payload.new.id) ? prev : [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setWorkCardScrapTotals(prev => prev.map(row => row.id === payload.new.id ? { ...row, ...payload.new } : row))
          } else if (payload.eventType === 'DELETE') {
            setWorkCardScrapTotals(prev => prev.filter(row => row.id !== payload.old.id))
          }
        })
    }

    if (needsFlowTotals) {
      activeChannel = activeChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'work_card_flow_totals' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setWorkCardFlowTotals(prev => prev.some(row => row.id === payload.new.id) ? prev : [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setWorkCardFlowTotals(prev => prev.map(row => row.id === payload.new.id ? { ...row, ...payload.new } : row))
          } else if (payload.eventType === 'DELETE') {
            setWorkCardFlowTotals(prev => prev.filter(row => row.id !== payload.old.id))
          }
        })
    }

    let hasSubscribed = false
    let reconnectRefreshTimer = null
    activeChannel.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      // The first SUBSCRIBED belongs to this route's initial channel. Route
      // loading already reconciles its snapshot; catch up only after an actual
      // disconnect/reconnect on the same channel instance.
      const shouldCatchUp = hasSubscribed
      hasSubscribed = true
      if (!shouldCatchUp) return

      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      reconnectRefreshTimer = setTimeout(() => {
        const targets = ['tasks', 'work_cards', 'inventory']
          .filter(tableName => routeHasTable(tableName))
        if (shouldLoadHistorySnapshot) targets.push('work_card_history')
        if (needsScrapTotals) targets.push('work_card_scrap_totals')
        if (needsFlowTotals) targets.push('work_card_flow_totals')
        targets.forEach(tableName => { delete targetRefreshLastRef.current[getTargetRefreshKey(tableName)] })
        const catchUp = targets.length > 0 ? fetchData(targets) : Promise.resolve()
        catchUp
          .then(() => needsProductionSummary ? refreshProductionSummary({ force: true }) : null)
          .catch(error => console.warn('Core Realtime catch-up failed:', error))
      }, Math.floor(Math.random() * 2001))
    })
    return () => {
      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      if (productionSummaryRefreshTimer) clearTimeout(productionSummaryRefreshTimer)
      supabase.removeChannel(activeChannel)
    }
  }, [currentUser?.id, realtimeProfile, routeDataTableKey, needsProductionSummary])

  // --- REAL-TIME для решти таблиць (orders, склад, Kanban тощо) ---
  // Точкові підписки замість глобального fetchData() на кожну подію

  // Дебаунс-буфер для push-сповіщень запитів матеріалів
  // Групує всі рядки одного наряду і надсилає ОДИН пуш
  const matReqPushBufferRef = useRef({}) // { [orderId]: { timer, items[], isPackaging, notifyIds[] } }

  useEffect(() => {
    const secondaryTables = [
      'orders',
      'management_tasks',
      'task_projects',
      'customers',
      'material_requests',
      'reception_docs',
      'purchase_requests',
      'machines',
      'machine_operations',
      'machine_calls',
      'system_users',
      'company_structure',
      'company_positions'
    ]
    if (!currentUser?.id || realtimeProfile === 'public' || !secondaryTables.some(tableName => routeHasTable(tableName))) return undefined

    const isSettings = realtimeProfile === 'settings'
    const orderHydrationTimers = new Map()

    const mergeRealtimeOrder = (incoming) => {
      if (!incoming?.id) return
      setOrders(prev => {
        const existing = prev.find(order => String(order.id) === String(incoming.id))
        const merged = existing
          ? { ...existing, ...incoming, order_items: incoming.order_items || existing.order_items || [] }
          : { ...incoming, order_items: incoming.order_items || [] }
        return [merged, ...prev.filter(order => String(order.id) !== String(incoming.id))]
          .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
      })
    }

    const scheduleOrderHydration = (orderId) => {
      if (!orderId || orderHydrationTimers.has(String(orderId))) return
      const timer = setTimeout(async () => {
        orderHydrationTimers.delete(String(orderId))
        const { data, error } = await supabase
          .from('orders')
          .select('*, order_items(*)')
          .eq('id', orderId)
          .maybeSingle()
        if (!error && data) mergeRealtimeOrder(data)
      }, 750 + Math.floor(Math.random() * 1751))
      orderHydrationTimers.set(String(orderId), timer)
    }

    let activeChannel2 = supabase.channel('mes-secondary-updates')

    // Orders & Kanban — manager, director, foreman, settings (not operators or warehouse)
    if (routeHasTable('orders')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
          mergeRealtimeOrder(payload.new)
          scheduleOrderHydration(payload.new?.id)
          if (isLocalWrite('orders', payload.new)) {
            const notifyIds = (systemUsersRef.current || []).filter(u => {
              if (!u?.access_rights) return false
              const settings = u.notification_settings || {}
              if (settings.new_order === false) return false
              return u.access_rights.director || u.access_rights.master || u.access_rights.manager
            }).map(u => u.id)
            if (notifyIds.length > 0) {
              const orderNum = payload.new?.order_num || ''
              const customer = payload.new?.customer || ''
              sendPushToUsers(
                notifyIds,
                '📦 Нове замовлення',
                `№ ${orderNum}${customer ? ` — ${customer}` : ''} очікує на створення наряду`,
                '/manager',
                { tag: `order-new-${payload.new.id}` }
              ).catch(() => { })
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
          mergeRealtimeOrder(payload.new)
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, (payload) => {
          const deletedId = payload.old?.id
          if (deletedId != null) {
            setOrders(prev => prev.filter(order => String(order.id) !== String(deletedId)))
          }
        })
    }

    if (routeHasTable('management_tasks')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'management_tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setManagementTasks(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setManagementTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t))
        } else if (payload.eventType === 'DELETE') {
          setManagementTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('task_projects')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'task_projects' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTaskProjects(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setTaskProjects(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        } else if (payload.eventType === 'DELETE') {
          setTaskProjects(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
    }

    if (routeHasTable('customers')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, (payload) => {
          setCustomers(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers' }, (payload) => {
          setCustomers(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
        })
    }

    // Material requests — always needed for warehouse, supply and operator screens to check stock requests
    if (routeHasTable('material_requests')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'material_requests' }, (payload) => {
        setRequests(prev => prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev])
        if (isLocalWrite('material_requests', payload.new)) {
          const isPackaging = payload.new?.details?.includes('КОМПЛЕКТУВАННЯ')
          const orderId = payload.new?.order_id || payload.new?.task_id || 'unknown'
          let orderNum = 'новий'
          if (payload.new?.task_id) {
            const t = tasksRef.current.find(item => item.id === payload.new.task_id)
            if (t) {
              if (t.step === 'Підготовка' && t.plan_snapshot?._prep_num) {
                orderNum = t.plan_snapshot._prep_num
              } else {
                const suffix = t.batch_index ? `/${t.batch_index}` : ''
                if (t.order_id) {
                  const o = ordersRef.current.find(item => item.id === t.order_id)
                  if (o?.order_num) orderNum = `${o.order_num}${suffix}`
                } else if (t.plan_snapshot?._prep_num) {
                  orderNum = t.plan_snapshot._prep_num
                }
              }
            }
          } else if (payload.new?.order_id) {
            const o = ordersRef.current.find(item => item.id === payload.new.order_id)
            if (o?.order_num) orderNum = o.order_num
          }
          const notifyIds = (systemUsersRef.current || []).filter(u => {
            if (!u?.access_rights) return false
            const settings = u.notification_settings || {}
            if (isPackaging) {
              if (settings.packaging_request === false) return false
              return u.access_rights.warehouse || u.access_rights.supply
            } else {
              if (settings.material_request === false) return false
              return u.access_rights.warehouse
            }
          }).map(u => u.id)
          if (notifyIds.length > 0) {
            const buf = matReqPushBufferRef.current
            if (!buf[orderId]) {
              buf[orderId] = { items: [], isPackaging, notifyIds, orderNum }
            }
            buf[orderId].items.push(payload.new)
            if (buf[orderId].timer) clearTimeout(buf[orderId].timer)
            buf[orderId].timer = setTimeout(() => {
              const entry = buf[orderId]
              if (!entry) return
              delete buf[orderId]
              const itemCount = entry.items.length
              const num = entry.orderNum
              const title = entry.isPackaging ? '📦 Запит на комплектування' : '📋 Новий запит на СО'
              const body = entry.isPackaging
                ? `Наряд №${num} — ${itemCount} позицій до комплектування`
                : `Наряд №${num} — ${itemCount} позицій (листи, фрези)`
              sendPushToUsers(entry.notifyIds, title, body, '/warehouse', { tag: `req-group-${orderId}` }).catch(() => { })
            }, 1500)
          }
        }
      })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'material_requests' }, (payload) => {
          setRequests(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'material_requests' }, (payload) => {
          setRequests(prev => prev.filter(r => r.id !== payload.old.id))
        })
    }

    // Reception docs & Purchase requests — only needed for warehouse, supply and management, not operator terminals
    if (routeHasTable('reception_docs')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'reception_docs' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setReceptionDocs(prev => prev.some(d => d.id === payload.new.id) ? prev : [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setReceptionDocs(prev => prev.map(d => d.id === payload.new.id ? { ...d, ...payload.new } : d))
          } else if (payload.eventType === 'DELETE') {
            setReceptionDocs(prev => prev.filter(d => d.id !== payload.old.id))
          }
        })
    }

    if (routeHasTable('purchase_requests')) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'purchase_requests' }, (payload) => {
          setPurchaseRequests(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
          if (isLocalWrite('purchase_requests', payload.new)) {
            const notifyIds = (systemUsersRef.current || []).filter(u => {
              if (!u?.access_rights) return false
              const settings = u.notification_settings || {}
              if (settings.supply_request === false) return false
              return u.access_rights.supply || u.access_rights.procurement || u.access_rights.director
            }).map(u => u.id)
            if (notifyIds.length > 0) {
              const orderNum = payload.new?.order_num || ''
              const dest = payload.new?.destination_warehouse === 'production' ? 'СВ' : 'СО'
              sendPushToUsers(
                notifyIds,
                '🛒 Новий запит постачання',
                `Замовлення №${orderNum} → ${dest} потребує закупівлі матеріалів`,
                '/supply',
                { tag: `pr-${payload.new.id}` }
              ).catch(() => { })
            }
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'purchase_requests' }, (payload) => {
          setPurchaseRequests(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'purchase_requests' }, (payload) => {
          setPurchaseRequests(prev => prev.filter(p => p.id !== payload.old.id))
        })
    }

    // Machine updates, calls, operations — only needed for operators, foremen, engineering and management, not warehouse
    if (routeHasTable('machines')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setMachines(prev => prev.some(machine => machine.id === payload.new.id)
              ? prev
              : [...prev, payload.new].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
          } else if (payload.eventType === 'UPDATE') {
            setMachines(prev => prev.map(machine => machine.id === payload.new.id
              ? { ...machine, ...payload.new }
              : machine))
          } else if (payload.eventType === 'DELETE') {
            setMachines(prev => prev.filter(machine => machine.id !== payload.old.id))
          }
        })
    }

    if (routeHasTable('machine_operations')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'machine_operations' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setMachineOperations(prev => prev.some(o => o.id === payload.new.id) ? prev : [payload.new, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setMachineOperations(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
          } else if (payload.eventType === 'DELETE') {
            setMachineOperations(prev => prev.filter(o => o.id !== payload.old.id))
          }
        })
    }

    if (routeHasTable('machine_calls')) {
      activeChannel2 = activeChannel2.on('postgres_changes', { event: '*', schema: 'public', table: 'machine_calls' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setMachineCalls(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])
            if (isLocalWrite('machine_calls', payload.new)) {
              const call = payload.new
              const calledEmployeeId = call.called_employee_id
              const calledRole = call.called_role
              const operator = call.operator_name || 'Оператор'
              const machineObj = (machinesRef.current || []).find(m => m.id === call.machine_id)
              const machineName = machineObj ? machineObj.name : 'Верстат'
              let notifyIds = []
              if (calledEmployeeId) {
                notifyIds = [calledEmployeeId]
              } else {
                notifyIds = (systemUsersRef.current || []).filter(u => {
                  if (!u?.access_rights) return false
                  const settings = u.notification_settings || {}
                  if (settings.machine_call === false) return false
                  if (calledRole === 'master') {
                    return u.access_rights.master || u.access_rights.foreman || (u.position && u.position.toLowerCase().includes('майстер'))
                  }
                  if (calledRole === 'engineer') {
                    return u.access_rights.engineer || (u.position && u.position.toLowerCase().includes('інженер'))
                  }
                  if (calledRole === 'qc') {
                    return u.access_rights.brak || (u.position && (u.position.toLowerCase().includes('вкя') || u.position.toLowerCase().includes('якост')))
                  }
                  return false
                }).map(u => u.id)
              }
              if (notifyIds.length > 0) {
                let roleLabel = 'Майстра'
                let targetPath = '/master'
                if (calledRole === 'engineer') {
                  roleLabel = 'Інженера'
                  targetPath = '/engineer'
                }
                if (calledRole === 'qc') {
                  roleLabel = 'ВКЯ'
                  targetPath = '/brak'
                }
                sendPushToUsers(
                  notifyIds,
                  `🚨 Виклик ${roleLabel}`,
                  `${operator} викликає на ${machineName}`,
                  targetPath,
                  { tag: `call-${payload.new.id}` }
                ).catch(() => { })
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            setMachineCalls(prev => prev.map(c => c.id === payload.new.id ? payload.new : c))
          } else if (payload.eventType === 'DELETE') {
            setMachineCalls(prev => prev.filter(c => c.id !== payload.old.id))
          }
        })
    }

    // Static/rarely changed configuration tables are ONLY subscribed to when on Settings panel
    if (isSettings) {
      activeChannel2 = activeChannel2
        .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            setSystemUsers(prev => {
              if (prev.some(u => u.id === payload.new.id)) return prev
              const updated = [...prev, payload.new]
              return updated.sort((a, b) => (a.login || '').localeCompare(b.login || ''))
            })
          } else if (payload.eventType === 'UPDATE') {
            setSystemUsers(prev => {
              const existing = prev.find(u => u.id === payload.new.id)
              if (existing) {
                const keys = ['login', 'first_name', 'last_name', 'position', 'access_rights', 'department', 'shift', 'notification_settings', 'avatar']
                const hasChanges = keys.some(k => JSON.stringify(existing[k]) !== JSON.stringify(payload.new[k]))
                if (!hasChanges) {
                  existing.last_seen = payload.new.last_seen
                  return prev
                }
              }
              return prev.map(u => u.id === payload.new.id ? { ...u, ...payload.new } : u)
            })
          } else if (payload.eventType === 'DELETE') {
            setSystemUsers(prev => prev.filter(u => u.id !== payload.old.id))
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_structure' }, () => {
          supabase.from('company_structure').select('*').order('name').then(({ data, error }) => {
            if (!error && data && data.length > 0) setCompanyStructure(data)
          })
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'company_positions' }, () => {
          supabase.from('company_positions').select('*').order('name').then(({ data, error }) => {
            if (!error && data && data.length > 0) setCompanyPositions(data)
          })
        })
    }

    let hasSubscribed = false
    let reconnectRefreshTimer = null
    activeChannel2.subscribe((status) => {
      if (status !== 'SUBSCRIBED') return
      const shouldCatchUp = hasSubscribed
      hasSubscribed = true
      if (!shouldCatchUp) return

      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      reconnectRefreshTimer = setTimeout(() => {
        const targetList = secondaryTables.filter(tableName => routeHasTable(tableName))
        if (targetList.length === 0) return

        targetList.forEach(tableName => { delete targetRefreshLastRef.current[tableName] })
        fetchData(targetList).catch(error => console.warn('Secondary Realtime catch-up failed:', error))
      }, Math.floor(Math.random() * 2001))
    })
    return () => {
      if (reconnectRefreshTimer) clearTimeout(reconnectRefreshTimer)
      orderHydrationTimers.forEach(timer => clearTimeout(timer))
      orderHydrationTimers.clear()
      supabase.removeChannel(activeChannel2)
    }
  }, [currentUser?.id, realtimeProfile, routeDataTableKey])

  // --- SESSION INIT — INSTANT RESTORE ————————————————————————————— ---
  // Strategy: user object cached in localStorage → show portal INSTANTLY (0ms)
  // Then verify against DB in background. Only kicks out if user no longer exists.
  useEffect(() => {
    const savedLogin = localStorage.getItem('MES_SESSION_LOGIN')
    if (!savedLogin) {
      setSessionLoading(false)
      return
    }

    // ── Step 1: Restore from cache IMMEDIATELY (no network wait) ─────────────
    const cachedUserRaw = localStorage.getItem(USER_CACHE_KEY)
    if (cachedUserRaw) {
      try {
        const cachedUser = JSON.parse(cachedUserRaw)
        const token = localStorage.getItem('BACKEND_TOKEN')
        setCurrentUser({ ...cachedUser, token })
        setSessionLoading(false)  // ← Portal shows INSTANTLY from here
      } catch (e) {
        // corrupt cache — fall through to DB verify
      }
    }

    // ── Step 2: Verify in background (non-blocking) ──────────────────────
    const verifyPromise = supabase
      .from('system_users')
      .select('id,login,password,first_name,last_name,position,access_rights,department,shift')
      .eq('login', savedLogin)
      .maybeSingle()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 8000)
    )

    Promise.race([verifyPromise, timeoutPromise])
      .then((res) => {
        const { data } = res || {}
        if (data) {
          const token = localStorage.getItem('BACKEND_TOKEN')
          setCurrentUser({ ...data, token })
          // Update the cache with fresh data
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data))
        } else {
          // User deleted or login changed — force logout
          localStorage.removeItem('MES_SESSION_LOGIN')
          localStorage.removeItem(USER_CACHE_KEY)
          setCurrentUser(null)
        }
        setSessionLoading(false)  // Safety: ensure loading stops even if cache was corrupt
      })
      .catch(() => {
        // Network error or timeout: keep cached user, don't force logout
        setSessionLoading(false)
      })
  }, [])

  useEffect(() => {
    if (currentUser?.id && systemUsers.length > 0) {
      const fresh = systemUsers.find(u => u.id === currentUser.id)
      if (fresh) {
        // Compare all key fields (excluding last_seen / token) to avoid updating object reference on presence-only ticks
        const fields = ['login', 'password', 'first_name', 'last_name', 'position', 'department', 'shift', 'access_rights', 'avatar', 'notification_settings']
        const hasDiff = fields.some(k => JSON.stringify(currentUser[k]) !== JSON.stringify(fresh[k]))
        if (hasDiff) {
          setCurrentUser(prev => ({ ...fresh, token: prev?.token }))
        }
      }
    }
  }, [systemUsers])

  // Sync currentUser changes to localStorage cache
  useEffect(() => {
    if (currentUser) {
      const cleanUser = { ...currentUser }
      delete cleanUser.token
      localStorage.setItem('MES_SESSION_USER', JSON.stringify(cleanUser))
    } else {
      localStorage.removeItem('MES_SESSION_USER')
    }
  }, [currentUser])

  // --- AUTH-GATED INITIAL FETCH + LIGHTWEIGHT REACTIVATION CATCH-UP ---
  // Login/session verification is independent. Operational data starts exactly
  // once after a user is available, so the public login screen cannot create a
  // full database burst.
  const lastVisibilityRefreshRef = useRef(0)
  const initialFetchTimerRef = useRef(null)
  const visibilityRefreshTimerRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    if (!currentUser?.id || isPublicDataRoute) {
      initialFetchCompletedUserIdRef.current = null
      initialFetchScheduleRef.current = { userId: null, notBefore: 0 }
      if (initialFetchTimerRef.current) {
        clearTimeout(initialFetchTimerRef.current)
        initialFetchTimerRef.current = null
      }
      return undefined
    }

    if (initialFetchCompletedUserIdRef.current !== currentUser.id && !initialFetchTimerRef.current) {
      lastVisibilityRefreshRef.current = Date.now()
      const scheduledUserId = currentUser.id
      const delay = getInitialFetchDelayMs()

      const runInitialFetch = () => {
        initialFetchTimerRef.current = null
        if (currentUserIdRef.current !== scheduledUserId) return
        fetchCritical()
          .catch(error => console.error('Initial critical data fetch failed:', error))
          .finally(() => {
            if (cancelled) return
            if (currentUserIdRef.current !== scheduledUserId) return
            if (initialFetchCompletedUserIdRef.current === scheduledUserId) return
            if (initialFetchTimerRef.current) return

            const retryDelay = INITIAL_FETCH_RETRY_BASE_MS
              + Math.floor(Math.random() * (INITIAL_FETCH_RETRY_JITTER_MS + 1))
            initialFetchTimerRef.current = setTimeout(runInitialFetch, retryDelay)
          })
      }

      initialFetchTimerRef.current = setTimeout(runInitialFetch, delay)
    }

    return () => {
      cancelled = true
      if (initialFetchTimerRef.current) {
        clearTimeout(initialFetchTimerRef.current)
        initialFetchTimerRef.current = null
      }
    }
  }, [currentUser?.id, isPublicDataRoute, routeDataTableKey])

  // Most terminals historically relied on the global bootstrap and did not
  // have their own mount loader. Load the current route's exact table set here
  // so `/` can stay tiny without making a terminal open with empty data.
  useEffect(() => {
    if (!currentUser?.id || isPublicDataRoute || routeDataTables.length === 0) return undefined

    let cancelled = false
    const now = Date.now()
    const missingOrStale = routeDataTables.filter(tableName => {
      const lastRun = targetRefreshLastRef.current[getTargetRefreshKey(tableName)] || 0
      return now - lastRun >= ROUTE_ENTRY_REFRESH_TTL_MS
    })
    if (missingOrStale.length === 0) return undefined

    const timer = setTimeout(() => {
      if (cancelled || currentUserIdRef.current !== currentUser.id) return
      const routeTargets = missingOrStale.filter(tableName => {
        const lastRun = targetRefreshLastRef.current[getTargetRefreshKey(tableName)] || 0
        return Date.now() - lastRun >= ROUTE_ENTRY_REFRESH_TTL_MS
      })
      const routeLoad = routeTargets.length > 0 ? fetchData(routeTargets) : Promise.resolve()
      routeLoad
        .then(() => needsProductionSummary ? refreshProductionSummary() : null)
        .catch(error => console.warn(`Route data load failed for ${normalizedPath}:`, error))
    }, Math.floor(Math.random() * (ROUTE_ENTRY_JITTER_MS + 1)))

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [currentUser?.id, isPublicDataRoute, routeDataTableKey, normalizedPath, needsProductionSummary])

  useEffect(() => {
    if (!currentUser?.id || path !== '/foreman2') return
    fetchData(['work_card_scrap_totals', 'work_card_flow_totals'])
      .catch(error => console.warn('Failed to load Foreman2 projections:', error))
  }, [currentUser?.id, path])

  useEffect(() => {
    if (!currentUser?.id || isPublicDataRoute) return undefined

    const getReactivationTargets = () => {
      const staticTables = new Set([
        'nomenclatures',
        'bom_items',
        'system_users',
        'company_structure',
        'company_positions',
        'customers'
      ])
      return routeDataTables.filter(tableName => !staticTables.has(tableName))
    }

    const handleRefresh = () => {
      const now = Date.now()
      if (fullFetchInFlightRef.current) return
      if (visibilityRefreshTimerRef.current) return
      if (now - lastVisibilityRefreshRef.current < VISIBILITY_REFRESH_COOLDOWN_MS) return

      // focus + visibilitychange often fire together; the pending timer itself
      // is the deduplication guard. The cooldown begins only when work starts,
      // so a route change that cancels this timer cannot suppress the next sync.
      const delay = Math.floor(Math.random() * VISIBILITY_REFRESH_JITTER_MS)
      visibilityRefreshTimerRef.current = setTimeout(() => {
        visibilityRefreshTimerRef.current = null
        if (document.visibilityState !== 'visible') return
        lastVisibilityRefreshRef.current = Date.now()
        fetchData(getReactivationTargets())
          .then(() => needsProductionSummary ? refreshProductionSummary() : null)
          .catch(error => console.warn('Targeted reactivation refresh failed:', error))
      }, delay)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleRefresh)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleRefresh)
      if (visibilityRefreshTimerRef.current) {
        clearTimeout(visibilityRefreshTimerRef.current)
        visibilityRefreshTimerRef.current = null
      }
    }
  }, [currentUser?.id, isPublicDataRoute, routeDataTableKey, needsProductionSummary])


  const upsertCompanyStructure = async (node) => {
    try {
      const payload = { ...node }
      if (!payload.id || payload.id.length < 5) {
        delete payload.id
      }
      const { data: res, error } = await supabase.from('company_structure').upsert([payload]).select()
      if (error) throw error
      if (res && res.length > 0) {
        setCompanyStructure(prev => {
          const idx = prev.findIndex(item => item.id === res[0].id)
          if (idx >= 0) {
            const next = [...prev]; next[idx] = res[0]; return next
          }
          return [...prev, res[0]]
        })
        return { data: res[0], error: null }
      }
    } catch (e) {
      console.error("Failed to upsert company structure:", e)
      const fallbackNode = { ...node }
      if (!fallbackNode.id) fallbackNode.id = String(Date.now())
      setCompanyStructure(prev => {
        const idx = prev.findIndex(item => item.id === fallbackNode.id || item.name === fallbackNode.name)
        if (idx >= 0) {
          const next = [...prev]; next[idx] = fallbackNode; return next
        }
        return [...prev, fallbackNode]
      })
      return { data: fallbackNode, error: e }
    }
  }

  const deleteCompanyStructure = async (id) => {
    try {
      const { error } = await supabase.from('company_structure').delete().eq('id', id)
      if (error) throw error
      setCompanyStructure(prev => prev.filter(item => item.id !== id))
      return { error: null }
    } catch (e) {
      console.error("Failed to delete company structure:", e)
      setCompanyStructure(prev => prev.filter(item => item.id !== id))
      return { error: e }
    }
  }

  const upsertCompanyPosition = async (pos) => {
    try {
      const payload = { ...pos }
      if (!payload.id || payload.id.length < 5) {
        delete payload.id
      }
      let { data: res, error } = await supabase.from('company_positions').upsert([payload]).select()

      // Fallback if the user hasn't run the SQL script to add the department_id column yet
      if (error && error.message && error.message.includes('department_id') && 'department_id' in payload) {
        console.warn("department_id column is missing, retrying without it:", error.message)
        const fallbackPayload = { ...payload }
        delete fallbackPayload.department_id
        const retry = await supabase.from('company_positions').upsert([fallbackPayload]).select()
        if (!retry.error) {
          res = retry.data
          error = null
        }
      }

      // Fallback if the user hasn't run the SQL script to add the start_page column yet
      if (error && error.message && error.message.includes('start_page') && 'start_page' in payload) {
        console.warn("start_page column is missing, retrying without it:", error.message)
        const fallbackPayload = { ...payload }
        delete fallbackPayload.start_page
        const retry = await supabase.from('company_positions').upsert([fallbackPayload]).select()
        if (!retry.error) {
          res = retry.data ? [{ ...retry.data[0], start_page: payload.start_page }] : [{ ...payload }]
          error = new Error('MISSING_START_PAGE_COLUMN')
        }
      }

      if (error) {
        if (error.message === 'MISSING_START_PAGE_COLUMN') {
          if (res && res.length > 0) {
            setCompanyPositions(prev => {
              const idx = prev.findIndex(item => item.id === res[0].id)
              if (idx >= 0) {
                const next = [...prev]; next[idx] = res[0]; return next
              }
              return [...prev, res[0]]
            })
          }
          return { data: res ? res[0] : null, error }
        }
        throw error
      }
      if (res && res.length > 0) {
        setCompanyPositions(prev => {
          const idx = prev.findIndex(item => item.id === res[0].id)
          if (idx >= 0) {
            const next = [...prev]; next[idx] = res[0]; return next
          }
          return [...prev, res[0]]
        })
        return { data: res[0], error: null }
      }
    } catch (e) {
      console.error("Failed to upsert company position:", e)
      const fallbackPos = { ...pos }
      if (!fallbackPos.id) fallbackPos.id = String(Date.now())
      setCompanyPositions(prev => {
        const idx = prev.findIndex(item => item.id === fallbackPos.id || item.name === fallbackPos.name)
        if (idx >= 0) {
          const next = [...prev]; next[idx] = fallbackPos; return next
        }
        return [...prev, fallbackPos]
      })
      return { data: fallbackPos, error: e }
    }
  }

  const deleteCompanyPosition = async (id) => {
    try {
      const { error } = await supabase.from('company_positions').delete().eq('id', id)
      if (error) throw error
      setCompanyPositions(prev => prev.filter(item => item.id !== id))
      return { error: null }
    } catch (e) {
      console.error("Failed to delete company position:", e)
      setCompanyPositions(prev => prev.filter(item => item.id !== id))
      return { error: e }
    }
  }

  const clearAllData = useCallback(() => {
    setOrders([])
    setCustomers([])
    setInventory([])
    setTasks([])
    setManagementTasks([])
    setTaskProjects([])
    setRequests([])
    setNomenclatures([])
    setBomItems([])
    setReceptionDocs([])
    setPurchaseRequests([])
    setWorkCards([])
    setWorkCardHistory([])
    setWorkCardScrapTotals([])
    setWorkCardFlowTotals([])
    setMachines([])
    setSystemUsers([])
    setMachineOperations([])
    setMachineCalls([])
    setAccessLogs([])
    setCompanyStructure(fallbackStructure)
    setCompanyPositions(fallbackPositions)
    setCurrentUser(null)
    nomenclaturesLoadedRef.current = false
    bomItemsLoadedRef.current = false
    nomenclaturesRef.current = []
    bomItemsRef.current = []
    ordersRef.current = []
    tasksRef.current = []
    inventoryRef.current = []
    workCardHistoryRef.current = []
    receptionDocsRef.current = []
    purchaseRequestsRef.current = []
    companyStructureRef.current = []
    companyPositionsRef.current = []
    targetRefreshInFlightRef.current = {}
    targetRefreshLastRef.current = {}
    moduleLoadInFlightRef.current = {}
    productionSummaryInFlightRef.current = null
    fullFetchInFlightRef.current = null
    initialFetchCompletedUserIdRef.current = null
    initialFetchScheduleRef.current = { userId: null, notBefore: 0 }

    try {
      localStorage.removeItem(CACHE_KEY)
      removeIndexedCache(CACHE_KEY).catch(() => {})
      localStorage.removeItem(USER_CACHE_KEY)
      localStorage.removeItem('MES_SESSION_LOGIN')
      localStorage.removeItem('BACKEND_TOKEN')
    } catch (e) {
      console.warn('Failed to clear localStorage:', e)
    }
  }, [])


  const fetchCompletedManagementTasks = async (page = 0, pageSize = 20, user = null, isDirector = true) => {
    const from = page * pageSize
    const to = from + pageSize - 1
    try {
      let query = supabase
        .from('management_tasks')
        .select('*', { count: 'exact' })
        .eq('status', 'done')

      if (!isDirector && user?.login) {
        const login = user.login
        query = query.or(`created_by.eq.${login},assigned_to.eq.${login},assignees.cs.["${login}"],is_collective.eq.true`)
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error
      return { data: data || [], count: count || 0, error: null }
    } catch (e) {
      console.error('Failed to fetch completed management tasks:', e)
      return { data: [], count: 0, error: e }
    }
  }

  const fetchCompletedManagementTasksCount = async (user = null, isDirector = true) => {
    try {
      let query = supabase
        .from('management_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'done')

      if (!isDirector && user?.login) {
        const login = user.login
        query = query.or(`created_by.eq.${login},assigned_to.eq.${login},assignees.cs.["${login}"],is_collective.eq.true`)
      }

      const { count, error } = await query

      if (error) throw error
      return count || 0
    } catch (e) {
      console.error('Failed to fetch completed management tasks count:', e)
      return 0
    }
  }

  // Return all state and basic setters needed for actions
  return {
    orders, setOrders,
    customers, setCustomers,
    inventory, setInventory,
    tasks, setTasks,
    managementTasks, setManagementTasks,
    taskProjects, setTaskProjects,
    requests, setRequests,
    nomenclatures, setNomenclatures,
    bomItems, setBomItems,
    receptionDocs, setReceptionDocs,
    purchaseRequests, setPurchaseRequests,
    workCards, setWorkCards,
    workCardHistory, setWorkCardHistory,
    workCardScrapTotals, setWorkCardScrapTotals,
    workCardFlowTotals, setWorkCardFlowTotals,
    machines, setMachines,
    systemUsers, setSystemUsers,
    machineOperations, setMachineOperations,
    machineCalls, setMachineCalls,
    accessLogs, setAccessLogs,
    fortnetUrl, setFortnetUrl,
    currentUser, setCurrentUser,
    sessionLoading, setSessionLoading,
    loading, setLoading,
    hasMoreOrders, setHasMoreOrders,
    normalize, fetchOrders, fetchData, fetchCritical, fetchModuleData, refreshProductionSummary, fetchTaskPlanSnapshot, fetchHistoryRange, fetchTaskArchiveCards, fetchCompletedManagementTasks, fetchCompletedManagementTasksCount, refreshTable, clearAllData,
    productionData,
    companyStructure, setCompanyStructure, upsertCompanyStructure, deleteCompanyStructure,
    companyPositions, setCompanyPositions, upsertCompanyPosition, deleteCompanyPosition,
    maintenanceCheckEnabled, updateMaintenanceCheckEnabled
  }
}
