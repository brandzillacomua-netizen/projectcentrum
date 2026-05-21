import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { supabase } from '../supabase'

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

export function useData() {

  // ── Lazy initialisers: localStorage is parsed ONCE per mount, not on every render ──
  const [orders, setOrders] = useState(fromCache('orders', []))
  const [customers, setCustomers] = useState(fromCache('customers', []))
  const [inventory, setInventory] = useState(fromCache('inventory', []))
  const [tasks, setTasks] = useState(fromCache('tasks', []))
  const [managementTasks, setManagementTasks] = useState(fromCache('managementTasks', []))
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
  const [accessLogs, setAccessLogs] = useState(() => [])
  const [fortnetUrl, setFortnetUrl] = useState(localStorage.getItem('FORTNET_API_URL') || 'http://192.168.1.100:8090')
  const [companyStructure, setCompanyStructure] = useState(fromCache('companyStructure', fallbackStructure))
  const [companyPositions, setCompanyPositions] = useState(fromCache('companyPositions', fallbackPositions))
  
  const [currentUser, setCurrentUser] = useState(null)
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
    try {
      const threeDaysAgoTasks = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const [
        { data: su },
        { data: mc },
        { data: mt },
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
        { data: wch }
      ] = await Promise.all([
        // Users & machines — needed for portal access filtering
        supabase.from('system_users').select('*').order('login'),
        supabase.from('machines').select('*').order('name'),
        // Kanban badge counter
        supabase.from('management_tasks').select('*').neq('status', 'completed').order('created_at', { ascending: false }),
        // Customers for manager
        supabase.from('customers').select('id,name,official_name').limit(50).order('name'),
        // Latest orders WITH order_items — needed by Master, Foreman, Director for naryad creation
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 99),
        // Active tasks WITHOUT nested order JOIN — order data is already in orders state
        supabase.from('tasks').select('id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,plan_snapshot,batch_index,planned_deadline,machine_name,created_at,completed_at').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false }),
        // Nomenclatures & BOM needed for naryad creation
        supabase.from('nomenclatures').select('*').limit(2000),
        supabase.from('bom_items').select('*').limit(4000),
        // Active work cards for real-time sync across terminals
        supabase.from('work_cards').select('*').neq('status', 'completed').order('created_at', { ascending: true }),
        supabase.from('company_structure').select('*').order('name').then(res => res, () => ({ data: fallbackStructure, error: null })),
        supabase.from('company_positions').select('*').order('name').then(res => res, () => ({ data: fallbackPositions, error: null })),
        // Global Real-time Tables
        supabase.from('inventory').select('*').order('name').limit(3000),
        supabase.from('material_requests').select('*').neq('status', 'completed').order('created_at', { ascending: false }),
        supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(200)
      ])

      if (su) setSystemUsers(su)
      if (mc) setMachines(mc)
      if (mt) setManagementTasks(mt)
      if (c) setCustomers(c)
      if (!oErr && latest) setOrders(latest)
      if (t) setTasks(t)
      if (n) setNomenclatures(n)
      if (b) setBomItems(b)
      if (wc) setWorkCards(wc)
      if (inv) setInventory(inv)
      if (req) setRequests(req)
      if (rec) setReceptionDocs(rec)
      if (pr) setPurchaseRequests(pr)
      if (wch) setWorkCardHistory(wch)
      
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
    }
  }

  // ── LEVEL 2: Full data — called lazily by modules that need it ────────────
  const fetchData = async (force = false) => {
    if (!force && Date.now() - lastFetchTime < 1000) return
    try {
      setLastFetchTime(Date.now())
      const threeDaysAgoTasks = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

      const [
        { data: latest, error: oErr },
        { data: t },
        { data: n },
        { data: b },
        { data: mc },
        { data: su },
        { data: mt },
        { data: wc },
        structRes,
        { data: inv },
        { data: req },
        { data: rec },
        { data: pr },
        { data: wch }
      ] = await Promise.all([
        supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 99),
        // tasks WITHOUT nested JOIN — avoids the orders(order_items(*)) waterfall
        supabase.from('tasks').select('id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,plan_snapshot,batch_index,planned_deadline,machine_name,created_at,completed_at').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false }),
        supabase.from('nomenclatures').select('*').limit(2000),
        supabase.from('bom_items').select('*').limit(4000),
        supabase.from('machines').select('*').order('name'),
        supabase.from('system_users').select('*').order('login'),
        supabase.from('management_tasks').select('*').neq('status', 'completed').order('created_at', { ascending: false }),
        supabase.from('work_cards').select('*').neq('status', 'completed').order('created_at', { ascending: true }),
        supabase.from('company_structure').select('*').order('name').then(res => res, () => ({ data: fallbackStructure, error: null })),
        supabase.from('inventory').select('*').order('name').limit(3000),
        supabase.from('material_requests').select('*').neq('status', 'completed').order('created_at', { ascending: false }),
        supabase.from('reception_docs').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('purchase_requests').select('*').order('created_at', { ascending: false }).limit(300),
        supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(200)
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

      if (t) setTasks(t)
      if (n) setNomenclatures(n)
      if (b) setBomItems(b)
      if (mc) setMachines(mc)
      if (su) setSystemUsers(su)
      if (mt) setManagementTasks(mt)
      if (wc) setWorkCards(wc)
      if (inv) setInventory(inv)
      if (req) setRequests(req)
      if (rec) setReceptionDocs(rec)
      if (pr) setPurchaseRequests(pr)
      if (wch) setWorkCardHistory(wch)
      
      if (structRes && structRes.data && structRes.data.length > 0) {
        setCompanyStructure(structRes.data)
      }
    } catch (e) {
      console.error('fetchData error:', e)
    }
  }

  // ── Module-specific lazy loaders (called on module mount) ─────────────────
  const fetchModuleData = async (moduleName) => {
    // Lazy module fetching is disabled.
    // All critical operational data is now eagerly loaded in fetchCritical() and fetchData().
    // This allows background real-time updates to seamlessly sync global application state.
  }

  const fetchHistoryRange = async (startDate, endDate) => {
    try {
      let query = supabase.from('work_card_history').select('*').order('created_at', { ascending: false })
      if (startDate) query = query.gte('completed_at', startDate)
      if (endDate) query = query.lte('completed_at', endDate)
      const { data, error } = await query.limit(2000)
      if (error) throw error
      return data || []
    } catch (e) { return [] }
  }

  const fetchTaskArchiveCards = async (taskId) => {
    try {
      const { data, error } = await supabase.from('work_cards').select('*').eq('task_id', taskId).eq('status', 'completed')
      if (error) throw error
      return data || []
    } catch (e) { return [] }
  }

  const refreshTable = async (tableName) => {
    try {
      if (tableName === 'work_cards') {
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
        const { data } = await supabase.from('work_cards').select('*').neq('status', 'completed').order('created_at', { ascending: true })
        if (data) setWorkCards(data)
      } else if (tableName === 'inventory') {
        const { data } = await supabase.from('inventory').select('*').order('name')
        if (data) setInventory(data)
      } else if (tableName === 'tasks') {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        // No nested JOIN — tasks reference orders via order_id already in state
        const { data } = await supabase.from('tasks').select('id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,plan_snapshot,batch_index,planned_deadline,machine_name,created_at,completed_at').or(`status.neq.completed,completed_at.gte.${threeDaysAgo}`).order('created_at', { ascending: false })
        if (data) setTasks(data)
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
      }
    } catch (e) { console.error(`Error refreshing ${tableName}:`, e) }
  }

  const productionData = useMemo(() => {
    const finishingStages = ['пакування/сгп', 'прийомка', 'склад бз', 'сгп', 'пакування']
    const finalRecords = (workCardHistory || []).filter(h => finishingStages.includes((h.stage_name || '').toLowerCase().trim()))
    return {
      totalProduced: finalRecords.reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0),
      totalScrap: (workCardHistory || []).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
    }
  }, [workCardHistory])

  // --- PERSISTENCE (дебаунс 2с + тільки критичні поля щоб не блокувати UI) ---
  const cacheTimerRef = useRef(null)
  useEffect(() => {
    if (cacheTimerRef.current) clearTimeout(cacheTimerRef.current)
    cacheTimerRef.current = setTimeout(() => {
      try {
        const dataToCache = {
          orders: orders.slice(0, 100),
          customers,
          tasks,
          managementTasks,
          requests,
          nomenclatures,
          bomItems,
          machines,
          systemUsers,
          machineOperations,
          companyStructure,
          companyPositions,
          workCards: workCards.slice(0, 300),
          inventory: inventory.slice(0, 2000),
          receptionDocs: receptionDocs.slice(0, 100),
          purchaseRequests: purchaseRequests.slice(0, 100),
          workCardHistory: workCardHistory.slice(0, 100)
        }
        localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache))
      } catch (e) {
        console.warn('Cache write failed (quota?):', e)
      }
    }, 2000) // Затримка 2с після останньої зміни
  }, [orders, customers, tasks, managementTasks, requests, nomenclatures, bomItems, machines, systemUsers, machineOperations, companyStructure, companyPositions, workCards, inventory, receptionDocs, purchaseRequests, workCardHistory])

  // --- REAL-TIME ---
  useEffect(() => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const channel = supabase.channel('mes-global-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_cards' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          if (payload.new.status === 'completed') {
            const cardDate = new Date(payload.new.created_at || payload.new.updated_at || Date.now())
            if (cardDate > threeDaysAgo) {
              setWorkCards(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
              setWorkCards(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])
            } else {
              setWorkCards(prev => prev.filter(c => c.id !== payload.new.id))
            }
          } else {
            setWorkCards(prev => prev.map(c => c.id === payload.new.id ? { ...c, ...payload.new } : c))
          }
        } else if (payload.eventType === 'INSERT') {
          const cardDate = new Date(payload.new.created_at || Date.now())
          if (payload.new.status !== 'completed' || cardDate > threeDaysAgo) {
            setWorkCards(prev => prev.some(c => c.id === payload.new.id) ? prev : [payload.new, ...prev])
          }
        } else if (payload.eventType === 'DELETE') {
          setWorkCards(prev => prev.filter(c => c.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, (payload) => {
        if (payload.eventType === 'UPDATE') {
          setTasks(prev => prev.map(t => t.id === payload.new.id ? { ...t, ...payload.new } : t))
          setTasks(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'INSERT') {
          setTasks(prev => prev.some(t => t.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'DELETE') {
          setTasks(prev => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, (payload) => {
        if (payload.eventType === 'UPDATE') setInventory(prev => prev.map(i => i.id === payload.new.id ? { ...i, ...payload.new } : i))
        else if (payload.eventType === 'INSERT') setInventory(prev => [payload.new, ...prev])
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'work_card_history' }, (payload) => {
        setWorkCardHistory(prev => prev.some(h => h.id === payload.new.id) ? prev : [payload.new, ...prev].slice(0, 300))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  // --- REAL-TIME для решти таблиць (orders, склад, Kanban тощо) ---
  // Точкові підписки замість глобального fetchData() на кожну подію
  useEffect(() => {
    const channel2 = supabase.channel('mes-secondary-updates')
      // Замовлення — менеджер, директор
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
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
      // Запити матеріалів — склад, майстер
      .on('postgres_changes', { event: '*', schema: 'public', table: 'material_requests' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRequests(prev => prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          if (payload.new.status === 'completed') {
            setRequests(prev => prev.filter(r => r.id !== payload.new.id))
          } else {
            setRequests(prev => prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r))
          }
        } else if (payload.eventType === 'DELETE') {
          setRequests(prev => prev.filter(r => r.id !== payload.old.id))
        }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_requests' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setPurchaseRequests(prev => prev.some(p => p.id === payload.new.id) ? prev : [payload.new, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setPurchaseRequests(prev => prev.map(p => p.id === payload.new.id ? { ...p, ...payload.new } : p))
        } else if (payload.eventType === 'DELETE') {
          setPurchaseRequests(prev => prev.filter(p => p.id !== payload.old.id))
        }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_users' }, () => {
        supabase.from('system_users').select('*').order('login').then(({ data }) => { if (data) setSystemUsers(data) })
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
    supabase
      .from('system_users')
      .select('id,login,password,first_name,last_name,position,access_rights,department,shift')
      .eq('login', savedLogin)
      .maybeSingle()
      .then(({ data }) => {
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
        // Network error: keep cached user, don't force logout
        setSessionLoading(false)
      })
  }, [])

  useEffect(() => {
    if (currentUser?.id && systemUsers.length > 0) {
      const fresh = systemUsers.find(u => u.id === currentUser.id)
      if (fresh) setCurrentUser(prev => ({ ...fresh, token: prev?.token }))
    }
  }, [systemUsers])

  // --- INITIAL DATA FETCH + SESSION init run in parallel ---
  // fetchCritical does NOT depend on currentUser, so start it immediately
  useEffect(() => {
    fetchCritical()
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
      
      if (error) throw error
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

  // Return all state and basic setters needed for actions
  return {
    orders, setOrders,
    customers, setCustomers,
    inventory, setInventory,
    tasks, setTasks,
    managementTasks, setManagementTasks,
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
    accessLogs, setAccessLogs,
    fortnetUrl, setFortnetUrl,
    currentUser, setCurrentUser,
    sessionLoading, setSessionLoading,
    loading, setLoading,
    hasMoreOrders, setHasMoreOrders,
    normalize, fetchOrders, fetchData, fetchCritical, fetchModuleData, fetchHistoryRange, fetchTaskArchiveCards, refreshTable,
    productionData,
    companyStructure, setCompanyStructure, upsertCompanyStructure, deleteCompanyStructure,
    companyPositions, setCompanyPositions, upsertCompanyPosition, deleteCompanyPosition
  }
}
