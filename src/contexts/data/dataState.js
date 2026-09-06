import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../../supabase.js'
import { wsBatcher } from '../../services/wsBatcher.js'
import { getIndexedCache, setIndexedCache, removeIndexedCache } from '../../services/indexedDbCache.js'
import {
  CACHE_KEY,
  USER_CACHE_KEY,
  fallbackStructure,
  fallbackPositions,
  fromCache,
  normalizeRoutePath,
  getRouteDataTables,
  getRealtimeProfile,
  PRODUCTION_SUMMARY_ROUTES,
  INITIAL_FETCH_JITTER_MS
} from './dataProfiles.js'

export function useDataState() {
  const location = useLocation()
  const path = location.pathname
  const normalizedPath = useMemo(() => normalizeRoutePath(path), [path])
  const realtimeProfile = useMemo(() => getRealtimeProfile(path), [path])
  const routeDataTables = useMemo(() => getRouteDataTables(path), [path])
  const routeDataTableKey = routeDataTables.join('|')
  const routeHasTable = (tableName) => routeDataTables.includes(tableName)
  const needsProductionSummary = PRODUCTION_SUMMARY_ROUTES.has(normalizedPath)
  const isPublicDataRoute = realtimeProfile === 'public'

  // ── State Declarations ──
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
      const isStrict = localStorage.getItem('MES_SESSION_STRICT') === 'true'
      const token = localStorage.getItem('BACKEND_TOKEN')
      // STRICT ENTERPRISE AUTH: Будь-яка стара сесія без JWT токена або без мітки
      // суворого режиму вважається недійсною і примусово розлогінюється на /login.
      if (!token || !isStrict) {
        localStorage.removeItem(USER_CACHE_KEY)
        localStorage.removeItem('MES_SESSION_LOGIN')
        localStorage.removeItem('BACKEND_TOKEN')
        localStorage.removeItem('MES_SESSION_STRICT')
        return null
      }
      const cached = localStorage.getItem(USER_CACHE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        return { ...parsed, token }
      }
    } catch (e) {
      console.warn('Failed to parse cached user:', e)
    }
    return null
  })
  const [sessionLoading, setSessionLoading] = useState(() => {
    const hasLogin = !!localStorage.getItem('MES_SESSION_LOGIN')
    const hasCache = !!localStorage.getItem('MES_SESSION_USER')
    return hasLogin && !hasCache
  })
  const [maintenanceCheckEnabled, setMaintenanceCheckEnabled] = useState(() => {
    return localStorage.getItem('maintenance_check_enabled') === 'true'
  })
  const [loading, setLoading] = useState(false)
  const [hasMoreOrders, setHasMoreOrders] = useState(true)
  const [serverProductionData, setServerProductionData] = useState(null)

  // ── All System Refs ──
  const lastSyncTimestampRef = useRef(0)
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
  const systemUsersRef = useRef([])
  const machinesRef = useRef([])
  const normalizedPathRef = useRef(normalizedPath)
  const cacheTimerRef = useRef(null)
  const matReqPushBufferRef = useRef({})
  const lastVisibilityRefreshRef = useRef(0)
  const initialFetchTimerRef = useRef(null)
  const visibilityRefreshTimerRef = useRef(null)

  // ── Sync states to refs in useEffect to avoid render-phase ref mutations ──
  useEffect(() => {
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
  })

  const setTasks = useCallback((nextOrUpdater) => {
    const nextTasks = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(tasksRef.current)
      : nextOrUpdater
    tasksRef.current = nextTasks
    setTasksState(nextTasks)
  }, [])

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

  // ── Incremental Catch-up on reconnect ──
  const performIncrementalCatchUp = useCallback(async (targetTables = []) => {
    if (!targetTables || targetTables.length === 0) return
    const baseTime = lastSyncTimestampRef.current || Date.now()
    const lastSyncISO = new Date(baseTime - 5000).toISOString()
    lastSyncTimestampRef.current = Date.now()

    console.info(`[CatchUpSync] Performing incremental catch-up for tables [${targetTables.join(', ')}] since ${lastSyncISO}...`)

    const fetchPromises = targetTables.map(async (table) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('updated_at', lastSyncISO)
        if (error || !data || data.length === 0) return { table, rows: [] }
        return { table, rows: data }
      } catch (err) {
        console.warn(`[CatchUpSync] Failed to fetch catch-up data for ${table}:`, err)
        return { table, rows: [] }
      }
    })

    const results = await Promise.all(fetchPromises)

    results.forEach(({ table, rows }) => {
      if (!rows || rows.length === 0) return
      console.info(`[CatchUpSync] Merging ${rows.length} updated rows for table '${table}'`)

      if (table === 'work_cards') {
        rows.forEach(r => wsBatcher.enqueue('work_cards', { eventType: 'UPDATE', new: r }))
      } else if (table === 'tasks') {
        rows.forEach(r => wsBatcher.enqueue('tasks', { eventType: 'UPDATE', new: r }))
      } else if (table === 'inventory') {
        rows.forEach(r => wsBatcher.enqueue('inventory', { eventType: 'UPDATE', new: r }))
      } else if (table === 'material_requests') {
        setRequests(prev => {
          let next = [...prev]
          rows.forEach(r => {
            next = next.map(item => item.id === r.id ? { ...item, ...r } : item)
            if (!next.some(item => item.id === r.id)) next.push(r)
          })
          return next
        })
      } else if (table === 'orders') {
        setOrders(prev => {
          let next = [...prev]
          rows.forEach(r => {
            next = next.map(item => item.id === r.id ? { ...item, ...r } : item)
            if (!next.some(item => item.id === r.id)) next.push(r)
          })
          return next
        })
      }
    })
  }, [])

  // ── IndexedDB initial hydration ──
  useEffect(() => {
    let isMounted = true
    getIndexedCache(CACHE_KEY).then(idbCache => {
      if (!isMounted || !idbCache) return
      if (idbCache.nomenclatures?.length > 0) setNomenclatures(idbCache.nomenclatures)
      if (idbCache.inventory?.length > 0) setInventory(idbCache.inventory)
      if (idbCache.orders?.length > 0) setOrders(idbCache.orders)
      if (idbCache.tasks?.length > 0) setTasksState(idbCache.tasks)
      if (idbCache.workCards?.length > 0) setWorkCards(idbCache.workCards)
      if (idbCache.bomItems?.length > 0) setBomItems(idbCache.bomItems)
    }).catch(err => console.warn('IndexedDB initial hydration warning:', err))

    return () => { isMounted = false }
  }, [])

  // ── Cache Debounced Sync to IndexedDB ──
  useEffect(() => {
    const timer = setTimeout(() => {
      setIndexedCache(CACHE_KEY, {
        nomenclatures,
        inventory,
        orders,
        tasks,
        workCards,
        bomItems,
        updatedAt: Date.now()
      }).catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [nomenclatures, inventory, orders, tasks, workCards, bomItems])

  // ── Maintenance check system config sync ──
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

  // ── Session Verification & User State ──
  useEffect(() => {
    const savedLogin = localStorage.getItem('MES_SESSION_LOGIN')
    if (!savedLogin) {
      return
    }

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
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data))
        } else {
          localStorage.removeItem('MES_SESSION_LOGIN')
          localStorage.removeItem(USER_CACHE_KEY)
          setCurrentUser(null)
        }
        setSessionLoading(false)
      })
      .catch(() => {
        setSessionLoading(false)
      })
  }, [])

  useEffect(() => {
    if (currentUser?.id && systemUsers.length > 0) {
      const fresh = systemUsers.find(u => u.id === currentUser.id)
      if (fresh) {
        const fields = ['login', 'password', 'first_name', 'last_name', 'position', 'department', 'shift', 'access_rights', 'avatar', 'notification_settings']
        const hasDiff = fields.some(k => JSON.stringify(currentUser[k]) !== JSON.stringify(fresh[k]))
        if (hasDiff) {
          queueMicrotask(() => {
            setCurrentUser(prev => ({ ...fresh, token: prev?.token }))
          })
        }
      }
    }
  }, [systemUsers, currentUser])

  useEffect(() => {
    if (currentUser) {
      const cleanUser = { ...currentUser }
      delete cleanUser.token
      localStorage.setItem('MES_SESSION_USER', JSON.stringify(cleanUser))
    } else {
      localStorage.removeItem('MES_SESSION_USER')
    }
  }, [currentUser])

  // ── Full cache persistence (debounced 2s) ──
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
        } catch {
          /* ignore cache removal failure */
        }
      }
    }, 2000)
  }, [orders, customers, tasks, managementTasks, taskProjects, requests, nomenclatures, bomItems, machines, systemUsers, machineOperations, machineCalls, companyStructure, companyPositions, workCards, inventory, receptionDocs, purchaseRequests, workCardHistory, workCardScrapTotals])

  // ── Production Data memo calculation ──
  const productionData = useMemo(() => {
    const finalRecords = (workCardHistory || []).filter(h => {
      const s = String(h.stage_name || '').toLowerCase().trim()
      return s.includes('пакування/сгп') || s.includes('прийомка') || s === 'склад бз' || s === 'сгп' || s === 'completed'
    })
    const fallback = {
      totalProduced: finalRecords.reduce((acc, h) => acc + (Number(h.qty_completed) || 0), 0),
      totalScrap: (workCardHistory || []).reduce((acc, h) => acc + (Number(h.scrap_qty) || 0), 0)
    }
    return serverProductionData ? {
      totalProduced: Number(serverProductionData.totalProduced) || 0,
      totalScrap: Number(serverProductionData.totalScrap) || 0
    } : fallback
  }, [workCardHistory, serverProductionData])

  // ── clearAllData ──
  const clearAllData = useCallback(() => {
    setOrders([])
    setCustomers([])
    setInventory([])
    setTasksState([])
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
    setCurrentUser(null)
    setCompanyStructure(fallbackStructure)
    setCompanyPositions(fallbackPositions)
    setServerProductionData(null)

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

  return {
    // States
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
    productionData,
    companyStructure, setCompanyStructure,
    companyPositions, setCompanyPositions,
    maintenanceCheckEnabled, setMaintenanceCheckEnabled,
    updateMaintenanceCheckEnabled,
    serverProductionData, setServerProductionData,

    // Routing & profile info
    path, normalizedPath, realtimeProfile, routeDataTables, routeDataTableKey,
    routeHasTable, needsProductionSummary, isPublicDataRoute, getInitialFetchDelayMs,

    // Actions & Sync
    performIncrementalCatchUp, clearAllData,

    // Refs
    ordersRef, tasksRef, inventoryRef, workCardHistoryRef, receptionDocsRef,
    purchaseRequestsRef, companyStructureRef, companyPositionsRef, systemUsersRef,
    machinesRef, targetRefreshInFlightRef, targetRefreshLastRef, moduleLoadInFlightRef,
    productionSummaryInFlightRef, fullFetchInFlightRef, initialFetchCompletedUserIdRef,
    initialFetchScheduleRef, currentUserIdRef, cacheTimerRef, matReqPushBufferRef,
    lastVisibilityRefreshRef, initialFetchTimerRef, visibilityRefreshTimerRef,
    nomenclaturesRef, bomItemsRef, nomenclaturesLoadedRef, bomItemsLoadedRef,
    normalizedPathRef
  }
}
