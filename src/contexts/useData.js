import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabase'

const CACHE_KEY = 'MES_APP_CACHE_V1'

const loadFromCache = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    return cached ? JSON.parse(cached) : {}
  } catch (e) {
    console.warn('Failed to load cache:', e)
    return {}
  }
}

export function useData() {
  const cache = loadFromCache()

  const [orders, setOrders] = useState(cache.orders || [])
  const [customers, setCustomers] = useState(cache.customers || [])
  const [inventory, setInventory] = useState(cache.inventory || [])
  const [tasks, setTasks] = useState(cache.tasks || [])
  const [managementTasks, setManagementTasks] = useState(cache.managementTasks || [])
  const [requests, setRequests] = useState(cache.requests || [])
  const [nomenclatures, setNomenclatures] = useState(cache.nomenclatures || [])
  const [bomItems, setBomItems] = useState(cache.bomItems || [])
  const [receptionDocs, setReceptionDocs] = useState(cache.receptionDocs || [])
  const [purchaseRequests, setPurchaseRequests] = useState(cache.purchaseRequests || [])
  const [workCards, setWorkCards] = useState(cache.workCards || [])
  const [workCardHistory, setWorkCardHistory] = useState(cache.workCardHistory || [])
  const [machines, setMachines] = useState(cache.machines || [])
  const [systemUsers, setSystemUsers] = useState(cache.systemUsers || [])
  const [accessLogs, setAccessLogs] = useState(cache.accessLogs || [])
  const [fortnetUrl, setFortnetUrl] = useState(localStorage.getItem('FORTNET_API_URL') || 'http://192.168.1.100:8090')
  
  const [currentUser, setCurrentUser] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(() => !!localStorage.getItem('MES_SESSION_LOGIN'))
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

  const fetchData = async (force = false) => {
    if (!force && Date.now() - lastFetchTime < 10000) return 
    if (orders.length === 0) setLoading(true)
    try {
      setLastFetchTime(Date.now())
      const { data: latest, error: oErr } = await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, PAGE_SIZE - 1)
      if (!oErr && latest) {
        setOrders(prev => {
          const next = [...prev]
          latest.forEach(newItem => {
            const idx = next.findIndex(o => o.id === newItem.id)
            if (idx >= 0) next[idx] = newItem
            else next.unshift(newItem)
          })
          return next.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
        })
      }

      const { data: c } = await supabase.from('customers').select('*').limit(50).order('name')
      const { data: i } = await supabase.from('inventory').select('*').order('name')
      const threeDaysAgoTasks = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { data: t } = await supabase.from('tasks').select('*').or(`status.neq.completed,completed_at.gte.${threeDaysAgoTasks}`).order('created_at', { ascending: false })
      const { data: r } = await supabase.from('material_requests').select('*').neq('status', 'completed').order('created_at', { ascending: false })
      const { data: n } = await supabase.from('nomenclatures').select('*')
      const { data: b } = await supabase.from('bom_items').select('*')
      
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
      const { data: rec } = await supabase.from('reception_docs').select('*').or(`status.neq.completed,created_at.gte.${threeDaysAgo}`).order('created_at', { ascending: false })
      const { data: pr } = await supabase.from('purchase_requests').select('*').or(`status.neq.completed,created_at.gte.${threeDaysAgo}`).order('created_at', { ascending: false })
      const { data: wc } = await supabase.from('work_cards').select('*').or(`status.neq.completed,created_at.gte.${threeDaysAgo}`).order('created_at', { ascending: true })

      const { data: mc } = await supabase.from('machines').select('*').order('name')
      const { data: su } = await supabase.from('system_users').select('*').order('login')
      const { data: mt } = await supabase.from('management_tasks').select('*').neq('status', 'completed').order('created_at', { ascending: false })

      if (c) setCustomers(c)
      if (i) setInventory(i)
      if (t) setTasks(t)
      if (mt) setManagementTasks(mt)
      if (r) setRequests(r)
      if (n) setNomenclatures(n)
      if (b) setBomItems(b)
      if (mc) setMachines(mc)
      if (su) setSystemUsers(su)
      if (rec) setReceptionDocs(rec)
      if (pr) setPurchaseRequests(pr)
      if (wc) setWorkCards(wc)

      const { data: wch } = await supabase.from('work_card_history').select('*').order('created_at', { ascending: false }).limit(200)
      if (wch) setWorkCardHistory(wch)
      const { data: al } = await supabase.from('access_logs').select('*').order('event_time', { ascending: false }).limit(200)
      if (al) setAccessLogs(al)
    } finally {
      setLoading(false)
    }
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
        const { data } = await supabase.from('work_cards').select('*').or(`status.neq.completed,created_at.gte.${twoDaysAgo}`).order('created_at', { ascending: true })
        if (data) setWorkCards(data)
      } else if (tableName === 'inventory') {
        const { data } = await supabase.from('inventory').select('*').order('name')
        if (data) setInventory(data)
      } else if (tableName === 'tasks') {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
        const { data } = await supabase.from('tasks').select('*').or(`status.neq.completed,completed_at.gte.${threeDaysAgo}`).order('created_at', { ascending: false })
        if (data) setTasks(data)
      } else if (tableName === 'orders') {
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

  // --- PERSISTENCE ---
  useEffect(() => {
    const dataToCache = {
      orders, customers, inventory, tasks, managementTasks, requests, nomenclatures,
      bomItems, receptionDocs, purchaseRequests, workCards, workCardHistory, machines, systemUsers, accessLogs
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache))
  }, [orders, customers, inventory, tasks, managementTasks, requests, nomenclatures, bomItems, receptionDocs, purchaseRequests, workCards, workCardHistory, machines, systemUsers])

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

  // --- SESSION INIT ---
  useEffect(() => {
    const savedLogin = localStorage.getItem('MES_SESSION_LOGIN')
    if (savedLogin) {
      supabase.from('system_users').select('*').eq('login', savedLogin).then(({ data }) => {
        if (data && data.length > 0) setCurrentUser(data[0])
        else localStorage.removeItem('MES_SESSION_LOGIN')
        setSessionLoading(false)
      })
    } else {
      setSessionLoading(false)
    }
  }, [])

  useEffect(() => {
    if (currentUser?.id && systemUsers.length > 0) {
      const fresh = systemUsers.find(u => u.id === currentUser.id)
      if (fresh) setCurrentUser(prev => ({ ...fresh, token: prev?.token }))
    }
  }, [systemUsers])

  // --- INITIAL DATA FETCH & REAL-TIME SYNC ---
  useEffect(() => {
    fetchData()

    const sub = supabase.channel('mes-changes')
      .on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData())
      .subscribe()
      
    return () => {
      supabase.removeChannel(sub)
    }
  }, [])

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
    accessLogs, setAccessLogs,
    fortnetUrl, setFortnetUrl,
    currentUser, setCurrentUser,
    sessionLoading, setSessionLoading,
    loading, setLoading,
    hasMoreOrders, setHasMoreOrders,
    normalize, fetchOrders, fetchData, fetchHistoryRange, fetchTaskArchiveCards, refreshTable,
    productionData
  }
}
