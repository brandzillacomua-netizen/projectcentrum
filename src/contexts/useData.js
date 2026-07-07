import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase, isLocalWrite } from '../supabase'
import { sendPushToUsers } from '../services/pushService'
import { getIndexedCache, setIndexedCache, removeIndexedCache } from '../services/indexedDbCache'
import { fetchProductionSummary } from '../services/statisticsService'

const CACHE_KEY = 'MES_APP_CACHE_V1'
const USER_CACHE_KEY = 'MES_SESSION_USER'  // Full user object for instant restore

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

    if (error) return { data: allCards.length > 0 ? allCards : null, error }
    allCards.push(...(data || []))
    if (!data || data.length < pageSize) break
  }

  return { data: allCards, error: null }
}
export function useData() {

  // ── Lazy initialisers: localStorage is parsed ONCE per mount, not on every render ──
  const [orders, setOrders] = useState(fromCache('orders', []))
  const [customers, setCustomers] = useState(fromCache('customers', []))
  const [inventory, setInventory] = useState(fromCache('inventory', []))
  const [tasks, setTasks] = useState(fromCache('tasks', []))
  const [managementTasks, setManagementTasks] = useState(fromCache('managementTasks', []))
  const [taskProjects, setTaskProjects] = useState(fromCache('taskProjects', []))
  const [requests, setRequests] = useState(fromCache('requests', []))
  const [nomenclatures, setNomenclatures] = useState(fromCache('nomenclatures', []))
  const [bomItems, setBomItems] = useState(fromCache('bomItems', []))
  const [receptionDocs, setReceptionDocs] = useState(fromCache('receptionDocs', []))
  const [purchaseRequests, setPurchaseRequests] = useState(fromCache('purchaseRequests', []))
  const [workCards, setWorkCards] = useState(fromCache('workCards', []))
  const [workCardHistory, setWorkCardHistory] = useState(fromCache('workCardHistory', []))
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

  const [loading, setLoading] = useState(false)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const [serverProductionData, setServerProductionData] = useState(null)

  const fetchInProgressRef = useRef(false)
  const nomenclaturesLoadedRef = useRef(false)
  const bomItemsLoadedRef = useRef(false)
  const nomenclaturesRef = useRef([])
  const bomItemsRef = useRef([])
  const inventoryRef = useRef([])
  const workCardHistoryRef = useRef([])
  const receptionDocsRef = useRef([])
  const purchaseRequestsRef = useRef([])
  const companyStructureRef = useRef([])
  const companyPositionsRef = useRef([])
  nomenclaturesRef.current = nomenclatures
  bomItemsRef.current = bomItems
  inventoryRef.current = inventory
  workCardHistoryRef.current = workCardHistory
  receptionDocsRef.current = receptionDocs
  purchaseRequestsRef.current = purchaseRequests
  companyStructureRef.current = companyStructure
  companyPositionsRef.current = companyPositions

  useEffect(() => {
    let cancelled = false
    getIndexedCache(CACHE_KEY).then(cached => {
      if (cancelled || !cached) return
      const restore = (setter, field) => setter(prev => Array.isArray(prev) && prev.length > 0 ? prev : (cached[field] ?? prev))
      restore(setOrders, 'orders')
      restore(setCustomers, 'customers')
      restore(setInventory, 'inventory')
      restore(setTasks, 'tasks')
      restore(setManagementTasks, 'managementTasks')
      restore(setTaskProjects, 'taskProjects')
      restore(setRequests, 'requests')
      restore(setNomenclatures, 'nomenclatures')
      restore(setBomItems, 'bomItems')
      restore(setReceptionDocs, 'receptionDocs')
      restore(setPurchaseRequests, 'purchaseRequests')
      restore(setWorkCards, 'workCards')
      restore(setWorkCardHistory, 'workCardHistory')
      restore(setMachines, 'machines')
      restore(setSystemUsers, 'systemUsers')
      restore(setMachineOperations, 'machineOperations')
      restore(setMachineCalls, 'machineCalls')
      restore(setCompanyStructure, 'companyStructure')
      restore(setCompanyPositions, 'companyPositions')
    }).catch(error => console.warn('Failed to restore IndexedDB cache:', error))
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    const refreshSummary = async () => {
      try {
        const summary = await fetchProductionSummary()
        if (!cancelled) setServerProductionData(summary)
      } catch (error) {
        console.warn('Failed to refresh production summary:', error)
      }
    }
    refreshSummary()
    const timer = setInterval(refreshSummary, 60000)
    return () => { cancelled = true; clearInterval(timer) }
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
    if (fetchInProgressRef.current) return
    fetchInProgressRef.current = true
    setLoading(true)
    try {
      const threeDaysAgoTasks = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      const [
        { data: su },
        { data: mc },
        { data: mt },
        { data: tp },
        { data: c },
        { data: latest, error: oErr },
        { data: t },
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
        { data: mo },
        { data: mCalls }
      ] = await Promise.all([
        // Users & machines — needed for portal access filtering
        supabase.from('system_users').select('id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar, last_seen, shift_calendar').order('login'),
        supabase.from('machines').select('*').order('name'),
        // Kanban badge counter
        supabase.from('management_tasks').select('*').neq('status', 'completed').order('created_at', { ascending: false }),
        supabase.from('task_projects').select('*').order('created_at', { ascending: false }),
        // Customers for manager
        supabase.from('customers').select('id,name,official_name').limit(50).order('name'),
        // Latest orders WITH order_items — needed by Master, Foreman, Director for naryad creation
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 99),
        // Active tasks WITHOUT nested order JOIN — order data is already in orders state
        supabase.from('tasks').select('id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,batch_index,planned_deadline,machine_name,created_at,completed_at,plan_snapshot').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false }),
        // Nomenclatures & BOM needed for naryad creation
        nomenclaturesLoadedRef.current ? Promise.resolve({ data: nomenclaturesRef.current }) : supabase.from('nomenclatures').select('*').limit(2000).then(res => { nomenclaturesLoadedRef.current = true; return res; }),
        bomItemsLoadedRef.current ? Promise.resolve({ data: bomItemsRef.current }) : supabase.from('bom_items').select('*').limit(4000).then(res => { bomItemsLoadedRef.current = true; return res; }),
        // Active (non-completed) work cards for real-time sync — completed are loaded separately per-task in ForemanWorkplace
        fetchActiveWorkCards(),
        companyStructureRef.current.length > fallbackStructure.length ? Promise.resolve({ data: companyStructureRef.current }) : supabase.from('company_structure').select('*').order('name').then(res => res, () => ({ data: fallbackStructure, error: null })),
        companyPositionsRef.current.length > fallbackPositions.length ? Promise.resolve({ data: companyPositionsRef.current }) : supabase.from('company_positions').select('*').order('name').then(res => res, () => ({ data: fallbackPositions, error: null })),
        // Global Real-time Tables
        inventoryRef.current.length > 0 ? Promise.resolve({ data: inventoryRef.current }) : supabase.from('inventory').select('*').order('name').limit(3000),
        supabase.from('material_requests').select('*').order('created_at', { ascending: false }).limit(1000),
        receptionDocsRef.current.length > 0 ? Promise.resolve({ data: receptionDocsRef.current }) : supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300),
        purchaseRequestsRef.current.length > 0 ? Promise.resolve({ data: purchaseRequestsRef.current }) : supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300),
        workCardHistoryRef.current.length > 0 ? Promise.resolve({ data: workCardHistoryRef.current }) : supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('machine_operations').select('*'),
        supabase.from('machine_calls').select('*').order('created_at', { ascending: false })
      ])

      if (su) setSystemUsers(su)
      if (mc) setMachines(mc)
      if (mt) setManagementTasks(mt)
      if (tp) setTaskProjects(tp)
      if (c) setCustomers(c)
      if (!oErr && latest) setOrders(latest)
      if (t) {
        // Keep plan_snapshot from already cached tasks if present
        setTasks(prev => {
          const cachedMap = new Map(prev.map(item => [item.id, item.plan_snapshot]))
          return t.map(item => ({
            ...item,
            plan_snapshot: item.plan_snapshot || cachedMap.get(item.id) || null
          }))
        })
      }
      if (n) setNomenclatures(n)
      if (b) setBomItems(b)
      if (wc) setWorkCards(wc)
      if (inv) setInventory(inv)
      if (req) setRequests(req)
      if (rec) setReceptionDocs(rec)
      if (pr) setPurchaseRequests(pr)
      if (wch) setWorkCardHistory(wch)
      if (mo) setMachineOperations(mo)
      if (mCalls) setMachineCalls(mCalls)

      if (structRes && structRes.data && structRes.data.length > 0) {
        setCompanyStructure(structRes.data)
      } else {
        setCompanyStructure(fallbackStructure)
      }
      if (posRes && posRes.data && posRes.data.length > 0) {
        setCompanyPositions(posRes.data)
      } else {
        setCompanyPositions(fallbackPositions)
      }
    } catch (e) {
      console.error('fetchCritical error:', e)
    } finally {
      setLoading(false)
      fetchInProgressRef.current = false
    }
  }

  // ── LEVEL 2: Full data — called lazily by modules that need it ────────────
  // ── LEVEL 2: Full data — called lazily by modules that need it ────────────
  const fetchData = async (forceOrTargets = false) => {
    if (typeof forceOrTargets === 'string' || Array.isArray(forceOrTargets)) {
      const targets = Array.isArray(forceOrTargets) ? forceOrTargets : [forceOrTargets]
      await Promise.all(targets.map(t => refreshTable(t).catch(() => { })))
      return
    }
    const force = forceOrTargets === true
    if (!force && Date.now() - lastFetchTime < 1000) return
    try {
      setLastFetchTime(Date.now())
      const threeDaysAgoTasks = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const needNomenclatures = nomenclaturesRef.current.length === 0
      const needBOM = bomItemsRef.current.length === 0
      const needMachines = machines.length === 0
      const needUsers = systemUsers.length === 0
      const needStructure = companyStructure.length <= fallbackStructure.length
      const needOperations = machineOperations.length === 0

      const [
        { data: latest, error: oErr },
        { data: t },
        { data: n },
        { data: b },
        { data: mc },
        { data: su },
        { data: mt },
        { data: tp },
        { data: wc },
        structRes,
        { data: inv },
        { data: req },
        { data: rec },
        { data: pr },
        { data: wch },
        { data: mo },
        { data: mCalls }
      ] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 99),
        // tasks WITHOUT nested JOIN — avoids the orders(order_items(*)) waterfall
        supabase.from('tasks').select('id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,batch_index,planned_deadline,machine_name,created_at,completed_at,plan_snapshot').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false }),
        needNomenclatures && !nomenclaturesLoadedRef.current ? supabase.from('nomenclatures').select('*').limit(2000).then(res => { nomenclaturesLoadedRef.current = true; return res; }) : Promise.resolve({ data: null }),
        needBOM && !bomItemsLoadedRef.current ? supabase.from('bom_items').select('*').limit(4000).then(res => { bomItemsLoadedRef.current = true; return res; }) : Promise.resolve({ data: null }),
        needMachines ? supabase.from('machines').select('*').order('name') : Promise.resolve({ data: null }),
        needUsers ? supabase.from('system_users').select('id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar, last_seen').order('login') : Promise.resolve({ data: null }),
        supabase.from('management_tasks').select('*').neq('status', 'completed').order('created_at', { ascending: false }),
        supabase.from('task_projects').select('*').order('created_at', { ascending: false }),
        fetchActiveWorkCards(),
        needStructure ? supabase.from('company_structure').select('*').order('name').then(res => res, () => ({ data: fallbackStructure, error: null })) : Promise.resolve({ data: null }),
        supabase.from('inventory').select('*').order('name').limit(3000),
        supabase.from('material_requests').select('*').order('created_at', { ascending: false }).limit(1000),
        supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(500),
        needOperations ? supabase.from('machine_operations').select('*') : Promise.resolve({ data: null }),
        supabase.from('machine_calls').select('*').order('created_at', { ascending: false })
      ])

      if (!oErr && latest) {
        setOrders(prev => {
          const existingIds = new Set(prev.map(o => o.id))
          const merged = [...prev]
          latest.forEach(newItem => {
            const idx = merged.findIndex(o => o.id === newItem.id)
            if (idx >= 0) merged[idx] = newItem
            else merged.unshift(newItem)
          })
          return merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        })
      }

      if (t) {
        // Keep plan_snapshot from already cached tasks if present
        setTasks(prev => {
          const cachedMap = new Map(prev.map(item => [item.id, item.plan_snapshot]))
          return t.map(item => ({
            ...item,
            plan_snapshot: item.plan_snapshot || cachedMap.get(item.id) || null
          }))
        })
      }
      if (needNomenclatures && n) setNomenclatures(n)
      if (needBOM && b) setBomItems(b)
      if (needMachines && mc) setMachines(mc)
      if (needUsers && su) setSystemUsers(su)
      if (mt) setManagementTasks(mt)
      if (tp) setTaskProjects(tp)
      if (wc) setWorkCards(wc)
      if (inv) setInventory(inv)
      if (req) setRequests(req)
      if (rec) setReceptionDocs(rec)
      if (pr) setPurchaseRequests(pr)
      if (wch) setWorkCardHistory(wch)
      if (needOperations && mo) setMachineOperations(mo)
      if (mCalls) setMachineCalls(mCalls)

      if (needStructure && structRes && structRes.data && structRes.data.length > 0) {
        setCompanyStructure(structRes.data)
      }
    } catch (e) {
      console.error('fetchData error:', e)
    }
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

  // ── Module-specific lazy loaders (called on module mount) ─────────────────
  const fetchModuleData = async (moduleName) => {
    // Lazy module fetching is disabled.
    // All critical operational data is now eagerly loaded in fetchCritical() and fetchData().
    // This allows background real-time updates to seamlessly sync global application state.
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
      if (tableName === 'work_cards') {
        const { data } = await fetchActiveWorkCards()
        if (data) setWorkCards(data)
      } else if (tableName === 'inventory') {
        const { data } = await supabase.from('inventory').select('*').order('name')
        if (data) setInventory(data)
      } else if (tableName === 'tasks') {
        const threeDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        // No nested JOIN — tasks reference orders via order_id already in state
        const { data } = await supabase.from('tasks').select('id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,batch_index,planned_deadline,machine_name,created_at,completed_at,plan_snapshot').or(`status.neq.completed,completed_at.gte.${threeDaysAgo}`).order('created_at', { ascending: false })
        if (data) {
          setTasks(prev => {
            const cachedMap = new Map(prev.map(item => [item.id, item.plan_snapshot]))
            return data.map(item => ({
              ...item,
              plan_snapshot: item.plan_snapshot || cachedMap.get(item.id) || null
            }))
          })
        }
      } else if (tableName === 'orders') {
        // Include order_items so modules that need quantities work correctly
        const { data } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 50)
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
        const { data } = await supabase.from('machine_operations').select('*')
        if (data) setMachineOperations(data)
      } else if (tableName === 'nomenclatures') {
        const { data } = await supabase.from('nomenclatures').select('*').limit(2000)
        if (data) {
          setNomenclatures(data)
          nomenclaturesLoadedRef.current = true
        }
      } else if (tableName === 'bom_items') {
        const { data } = await supabase.from('bom_items').select('*').limit(4000)
        if (data) {
          setBomItems(data)
          bomItemsLoadedRef.current = true
        }
      } else if (tableName === 'customers') {
        const { data } = await supabase.from('customers').select('id,name,official_name').order('name').limit(500)
        if (data) setCustomers(data)
      } else if (tableName === 'purchase_requests') {
        const { data } = await supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300)
        if (data) setPurchaseRequests(data)
      } else if (tableName === 'reception_docs') {
        const { data } = await supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300)
        if (data) setReceptionDocs(data)
      } else if (tableName === 'material_requests') {
        const { data } = await supabase.from('material_requests').select('*').order('created_at', { ascending: false }).limit(1000)
        if (data) setRequests(data)
      } else if (tableName === 'work_card_history') {
        const { data } = await supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(500)
        if (data) setWorkCardHistory(data)
      }
    } catch (e) { console.error(`Error refreshing ${tableName}:`, e) }
  }

  const productionData = useMemo(() => {
    const finishingStages = ['пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування']
    const finalRecords = (workCardHistory || []).filter(h => finishingStages.includes((h.stage_name || '').toLowerCase().trim()))
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
  const tasksRef = useRef([])
  useEffect(() => { tasksRef.current = tasks }, [tasks])
  const ordersRef = useRef([])
  useEffect(() => { ordersRef.current = orders }, [orders])
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
          workCardHistory
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
  }, [orders, customers, tasks, managementTasks, taskProjects, requests, nomenclatures, bomItems, machines, systemUsers, machineOperations, machineCalls, companyStructure, companyPositions, workCards, inventory, receptionDocs, purchaseRequests, workCardHistory])

  // --- REAL-TIME ---
  useEffect(() => {
    const threeDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const channel = supabase.channel('mes-global-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          if (payload.new.status === 'completed') {
            // Remove from global state — completed cards are tracked separately per-task
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
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
          // Push відвантажувальникам та директору коли партія стає готовою до відвантаження
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setInventory(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i))
        } else if (payload.eventType === 'INSERT') {
          setInventory(prev => prev.some(i => i.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setInventory(prev => prev.filter(i => i.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_card_history' }, (payload) => {
        setWorkCardHistory(prev => prev.some(h => h.id === payload.new.id) ? prev : [payload.new, ...prev].slice(0, 500))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'work_card_history' }, (payload) => {
        // Синхронізуємо оновлення (is_archived_scrap, qc_scrap_comment тощо) в реальному часі
        setWorkCardHistory(prev => prev.map(h => h.id === payload.new.id ? { ...h, ...payload.new } : h))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // --- REAL-TIME для решти таблиць (orders, склад, Kanban тощо) ---
  // Точкові підписки замість глобального fetchData() на кожну подію

  // Дебаунс-буфер для push-сповіщень запитів матеріалів
  // Групує всі рядки одного наряду і надсилає ОДИН пуш
  const matReqPushBufferRef = useRef({}) // { [orderId]: { timer, items[], isPackaging, notifyIds[] } }

  useEffect(() => {
    const channel2 = supabase.channel('mes-secondary-updates')
      // Замовлення — менеджер, директор
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        refreshTable('orders')
        // Push-сповіщення директору та майстрам при новому замовленні
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
        refreshTable('orders')
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'orders' }, () => {
        refreshTable('orders')
      })
      // Управлінські задачі — Kanban
      .on('postgres_changes', { event: '*', schema: 'public', table: 'management_tasks' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setManagementTasks(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setManagementTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t))
        } else if (payload.eventType === 'DELETE') {
          setManagementTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_projects' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTaskProjects(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setTaskProjects(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        } else if (payload.eventType === 'DELETE') {
          setTaskProjects(prev => prev.filter(p => p.id !== payload.old.id))
        }
      })
      // Запити матеріалів — склад, майстер
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'material_requests' }, (payload) => {
        setRequests(prev => prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev])

        // ─── ДЕБАУНС: збираємо всі рядки одного наряду і надсилаємо ОДИН пуш ───
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

            // Скидаємо таймер — чекаємо 1.5с після ОСТАННЬОГО рядка наряду
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
      // Документи прийомки — склад, постачання
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reception_docs' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setReceptionDocs(prev => prev.some(d => d.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setReceptionDocs(prev => prev.map(d => d.id === payload.new.id ? { ...d, ...payload.new } : d))
        } else if (payload.eventType === 'DELETE') {
          setReceptionDocs(prev => prev.filter(d => d.id !== payload.old.id))
        }
      })
      // Запити на закупівлю — постачання
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'purchase_requests' }, (payload) => {
        setPurchaseRequests(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
        // Пуш постачальникам та директору виробництва
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
      // Станки і користувачі — рідко змінюються, повний refetch
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machines' }, () => {
        supabase.from('machines').select('*').order('name').then(({ data }) => { if (data) setMachines(data) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_operations' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMachineOperations(prev => prev.some(o => o.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setMachineOperations(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
        } else if (payload.eventType === 'DELETE') {
          setMachineOperations(prev => prev.filter(o => o.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_calls' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setMachineCalls(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])

          // Надсилаємо Push-сповіщення при виклику персоналу до верстата
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
              const keys = Object.keys(payload.new).filter(k => k !== 'last_seen')
              const hasChanges = keys.some(k => String(existing[k]) !== String(payload.new[k]))
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
      // Клієнти — менеджер, реалтайм оновлення при додаванні нових замовників
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'customers' }, (payload) => {
        setCustomers(prev => prev.some(c => c.id === payload.new.id) ? prev : [...prev, payload.new].sort((a, b) => (a.name || '').localeCompare(b.name || '')))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers' }, (payload) => {
        setCustomers(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel2) }
  }, [])

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

  // --- INITIAL DATA FETCH + SESSION init run in parallel ---
  // fetchCritical does NOT depend on currentUser, so start it immediately
  const lastVisibilityRefreshRef = useRef(0)


  useEffect(() => {
    fetchCritical()

    const handleRefresh = () => {
      const now = Date.now()
      // Throttle: minimum 30s between reloads — prevents window.confirm focus events racing with async deletes
      if (now - lastVisibilityRefreshRef.current > 30000) {
        lastVisibilityRefreshRef.current = now
        console.log('[App Reactivation] Refreshing critical data on focus/visibility change')
        fetchCritical().catch(err => console.error(err))
      }
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
    }
  }, [])


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
    setMachines([])
    setSystemUsers([])
    setMachineOperations([])
    setMachineCalls([])
    setAccessLogs([])
    setCompanyStructure(fallbackStructure)
    setCompanyPositions(fallbackPositions)
    setCurrentUser(null)
    setLastFetchTime(0)

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
    normalize, fetchOrders, fetchData, fetchCritical, fetchModuleData, fetchTaskPlanSnapshot, fetchHistoryRange, fetchTaskArchiveCards, refreshTable, clearAllData,
    productionData,
    companyStructure, setCompanyStructure, upsertCompanyStructure, deleteCompanyStructure,
    companyPositions, setCompanyPositions, upsertCompanyPosition, deleteCompanyPosition
  }
}
