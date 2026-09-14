import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, prodClient, isTestEnvironment } from '../../supabase.js'
import { clearProductionSessionCache, restoreProductionSession } from '../../auth/productionSession.js'
import { useStore } from '../../store/index.js'
import { wsBatcher } from '../../services/wsBatcher.js'
import { getIndexedCache, setIndexedCache, removeIndexedCache } from '../../services/indexedDbCache.js'
import {
  CACHE_KEY,
  USER_CACHE_KEY,
  getActiveCacheKey,
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
  const routeHasTable = useCallback((tableName: string) => routeDataTables.includes(tableName), [routeDataTables])
  const needsProductionSummary = PRODUCTION_SUMMARY_ROUTES.has(normalizedPath)
  const isPublicDataRoute = realtimeProfile === 'public'

  // ── State Declarations ──
  const [orders, setOrders] = useState<any[]>(fromCache('orders', []))
  const [customers, setCustomers] = useState<any[]>(fromCache('customers', []))
  const [inventory, setInventory] = useState<any[]>(fromCache('inventory', []))
  const [tasks, setTasksState] = useState<any[]>(fromCache('tasks', []))
  const [managementTasks, setManagementTasks] = useState<any[]>(fromCache('managementTasks', []))
  const [taskProjects, setTaskProjects] = useState<any[]>(fromCache('taskProjects', []))
  const [requests, setRequests] = useState<any[]>(fromCache('requests', []))
  const [nomenclatures, setNomenclatures] = useState<any[]>(fromCache('nomenclatures', []))
  const [bomItems, setBomItems] = useState<any[]>(fromCache('bomItems', []))
  const [receptionDocs, setReceptionDocs] = useState<any[]>(fromCache('receptionDocs', []))
  const [purchaseRequests, setPurchaseRequests] = useState<any[]>(fromCache('purchaseRequests', []))
  const [workCards, setWorkCards] = useState<any[]>(fromCache('workCards', []))
  const [workCardHistory, setWorkCardHistory] = useState<any[]>(fromCache('workCardHistory', []))
  const [workCardScrapTotals, setWorkCardScrapTotals] = useState<any[]>(fromCache('workCardScrapTotals', []))
  const [workCardFlowTotals, setWorkCardFlowTotals] = useState<any[]>(() => [])
  const [machines, setMachines] = useState<any[]>(fromCache('machines', []))
  const [systemUsers, setSystemUsers] = useState<any[]>(fromCache('systemUsers', []))
  const [machineOperations, setMachineOperations] = useState<any[]>(fromCache('machineOperations', []))
  const [machineCalls, setMachineCalls] = useState<any[]>(fromCache('machineCalls', []))
  const [accessLogs, setAccessLogs] = useState<any[]>(() => [])
  const [fortnetUrl, setFortnetUrl] = useState<string>(() => localStorage.getItem('FORTNET_API_URL') || 'http://192.168.1.100:8090')
  const [companyStructure, setCompanyStructure] = useState<any[]>(fromCache('companyStructure', fallbackStructure))
  const [companyPositions, setCompanyPositions] = useState<any[]>(fromCache('companyPositions', fallbackPositions))

  const [currentUser, setCurrentUser] = useState<any>(() => {
    try {
      const isTest = isTestEnvironment()

      // Production authentication is restored asynchronously from the actual
      // Supabase session below. A cached profile alone must never unlock data.
      if (!isTest) return null

      const strictKey = isTest ? 'MES_SESSION_STRICT_STAGING' : 'MES_SESSION_STRICT'
      const tokenKey = isTest ? 'BACKEND_TOKEN_STAGING' : 'BACKEND_TOKEN'
      const userKey = isTest ? 'MES_SESSION_USER_STAGING' : 'MES_SESSION_USER'
      const loginKey = isTest ? 'MES_SESSION_LOGIN_STAGING' : 'MES_SESSION_LOGIN'

      let isStrict = localStorage.getItem(strictKey) === 'true'
      let token = localStorage.getItem(tokenKey)
      let cached = localStorage.getItem(userKey)

      // Seamless transition: If entering Staging while authenticated on Prod, inherit the session profile
      if (isTest && (!isStrict || !cached)) {
        const prodUser = localStorage.getItem('MES_SESSION_USER')
        if (prodUser) {
          localStorage.setItem(userKey, prodUser)
          localStorage.setItem(loginKey, localStorage.getItem('MES_SESSION_LOGIN') || '')
          localStorage.setItem(strictKey, 'true')
          cached = prodUser
          isStrict = true
        }
      }

      // Check session validity: Cached user profile with strict session confirmation
      if (!isStrict || !cached) {
        localStorage.removeItem(userKey)
        localStorage.removeItem(loginKey)
        localStorage.removeItem(tokenKey)
        localStorage.removeItem(strictKey)
        return null
      }
      if (cached) {
        const parsed = JSON.parse(cached)
        return { ...parsed, token }
      }
    } catch (e) {
      console.warn('Failed to parse cached user:', e)
    }
    return null
  })
  const [sessionLoading, setSessionLoading] = useState<boolean>(() => {
    if (!isTestEnvironment()) return true
    const hasLogin = !!localStorage.getItem('MES_SESSION_LOGIN')
    const hasCache = !!localStorage.getItem('MES_SESSION_USER')
    return hasLogin && !hasCache
  })

  useEffect(() => {
    // TEST/STAGING keeps its existing lifecycle. This guard deliberately
    // scopes the stricter bootstrap to the production client only.
    if (isTestEnvironment()) return undefined

    let active = true

    const finishBootstrap = async () => {
      try {
        const user = await restoreProductionSession(prodClient)
        if (active) setCurrentUser(user)
      } catch (error) {
        console.warn('[Auth] Не вдалося підтвердити PROD-сесію:', error?.message || error)
        clearProductionSessionCache()
        if (active) setCurrentUser(null)
      } finally {
        if (active) setSessionLoading(false)
      }
    }

    finishBootstrap()

    const { data: authListener } = prodClient.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT' || !active) return
      clearProductionSessionCache()
      setCurrentUser(null)
      setSessionLoading(false)
    })

    return () => {
      active = false
      authListener?.subscription?.unsubscribe()
    }
  }, [])
  const [maintenanceCheckEnabled, setMaintenanceCheckEnabled] = useState<boolean>(() => {
    return localStorage.getItem('maintenance_check_enabled') === 'true'
  })
  const [loading, setLoading] = useState<boolean>(false)
  const [hasMoreOrders, setHasMoreOrders] = useState<boolean>(true)
  const [serverProductionData, setServerProductionData] = useState<any>(() => ({ totalProduced: 0, totalScrap: 0 }))
  const productionData = serverProductionData || { totalProduced: 0, totalScrap: 0 }

  // ── All System Refs ──
  const lastSyncTimestampRef = useRef<number>(0)
  const fullFetchInFlightRef = useRef<any>(null)
  const currentUserIdRef = useRef<string | number | null>(currentUser?.id || null)
  const initialFetchCompletedUserIdRef = useRef<string | number | null>(null)
  const initialFetchScheduleRef = useRef<{ userId: string | number | null; notBefore: number }>({ userId: null, notBefore: 0 })
  const productionSummaryInFlightRef = useRef<any>(null)
  const moduleLoadInFlightRef = useRef<Record<string, boolean>>({})
  const targetRefreshInFlightRef = useRef<Set<string>>(new Set())
  const targetRefreshLastRef = useRef<Map<string, number>>(new Map())
  const nomenclaturesLoadedRef = useRef<boolean>(false)
  const bomItemsLoadedRef = useRef<boolean>(false)
  const nomenclaturesRef = useRef<any[]>(nomenclatures)
  const bomItemsRef = useRef<any[]>(bomItems)
  const ordersRef = useRef<any[]>(orders)
  const tasksRef = useRef<any[]>(tasks)
  const inventoryRef = useRef<any[]>([])
  const workCardHistoryRef = useRef<any[]>([])
  const receptionDocsRef = useRef<any[]>([])
  const purchaseRequestsRef = useRef<any[]>([])
  const companyStructureRef = useRef<any[]>([])
  const companyPositionsRef = useRef<any[]>([])
  const systemUsersRef = useRef<any[]>([])
  const machinesRef = useRef<any[]>([])
  const normalizedPathRef = useRef<string>(normalizedPath)
  const cacheTimerRef = useRef<any>(null)
  const matReqPushBufferRef = useRef<Record<string, any>>({})
  const lastVisibilityRefreshRef = useRef<number>(0)
  const initialFetchTimerRef = useRef<any>(null)
  const visibilityRefreshTimerRef = useRef<any>(null)

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

  // ── Sync state to Zustand store ──
  useEffect(() => {
    useStore.setState({
      orders,
      customers,
      inventory,
      tasks,
      managementTasks,
      taskProjects,
      requests,
      nomenclatures,
      bomItems,
      receptionDocs,
      purchaseRequests,
      workCards,
      workCardHistory,
      workCardScrapTotals,
      workCardFlowTotals,
      machines,
      systemUsers,
      machineOperations,
      machineCalls,
      companyStructure,
      companyPositions,
      currentUser,
      productionData
    })
  }, [
    orders, customers, inventory, tasks, managementTasks, taskProjects, requests,
    nomenclatures, bomItems, receptionDocs, purchaseRequests, workCards,
    workCardHistory, workCardScrapTotals, workCardFlowTotals, machines,
    systemUsers, machineOperations, machineCalls, companyStructure,
    companyPositions, currentUser, productionData
  ])

  const setTasks = useCallback((nextOrUpdater: any) => {
    const nextTasks = typeof nextOrUpdater === 'function'
      ? nextOrUpdater(tasksRef.current)
      : nextOrUpdater
    tasksRef.current = nextTasks
    setTasksState(nextTasks)
  }, [])

  const updateMaintenanceCheckEnabled = async (value: boolean) => {
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

  const getInitialFetchDelayMs = useCallback(() => {
    if (!currentUser?.id) return 0
    if (initialFetchScheduleRef.current.userId !== currentUser.id) {
      initialFetchScheduleRef.current = {
        userId: currentUser.id,
        notBefore: Date.now() + Math.floor(Math.random() * (INITIAL_FETCH_JITTER_MS + 1))
      }
    }
    return Math.max(0, initialFetchScheduleRef.current.notBefore - Date.now())
  }, [currentUser?.id])

  // ── Incremental Catch-up on reconnect ──
  const performIncrementalCatchUp = useCallback(async (targetTables: string[] = []) => {
    if (!targetTables || targetTables.length === 0) return { failedTables: [] }
    const now = Date.now()
    const baseTime = lastSyncTimestampRef.current > 0 ? lastSyncTimestampRef.current : (now - 10 * 60 * 1000)
    const lastSyncISO = new Date(Math.max(0, baseTime - 10000)).toISOString()
    lastSyncTimestampRef.current = now

    console.info(`[CatchUpSync] Performing incremental catch-up for tables [${targetTables.join(', ')}] since ${lastSyncISO}...`)

    const fetchPromises = targetTables.map(async (table) => {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gt('updated_at', lastSyncISO)
        if (error) {
          console.warn(`[CatchUpSync] Incremental query failed for ${table}:`, error.code || error.message)
          return { table, rows: [], failed: true }
        }
        if (!data || data.length === 0) return { table, rows: [], failed: false }
        return { table, rows: data, failed: false }
      } catch (err) {
        console.warn(`[CatchUpSync] Failed to fetch catch-up data for ${table}:`, err)
        return { table, rows: [], failed: true }
      }
    })

    const results = await Promise.all(fetchPromises)

    results.forEach(({ table, rows }) => {
      if (!rows || rows.length === 0) return
      console.info(`[CatchUpSync] Merging ${rows.length} updated rows for table '${table}'`)

      if (table === 'work_cards') {
        rows.forEach((r: any) => wsBatcher.enqueue('work_cards', { eventType: 'UPDATE', new: r }))
      } else if (table === 'tasks') {
        rows.forEach((r: any) => wsBatcher.enqueue('tasks', { eventType: 'UPDATE', new: r }))
      } else if (table === 'inventory') {
        rows.forEach((r: any) => wsBatcher.enqueue('inventory', { eventType: 'UPDATE', new: r }))
      } else if (table === 'material_requests') {
        setRequests(prev => {
          let next = [...prev]
          rows.forEach((r: any) => {
            next = next.map(item => item.id === r.id ? { ...item, ...r } : item)
            if (!next.some(item => item.id === r.id)) next.push(r)
          })
          return next
        })
      } else if (table === 'orders') {
        setOrders(prev => {
          let next = [...prev]
          rows.forEach((r: any) => {
            next = next.map(item => item.id === r.id ? { ...item, ...r } : item)
            if (!next.some(item => item.id === r.id)) next.push(r)
          })
          return next
        })
      }
    })

    return {
      failedTables: results.filter(r => r.failed).map(r => r.table)
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
    companyStructure, setCompanyStructure,
    companyPositions, setCompanyPositions,
    currentUser, setCurrentUser,
    sessionLoading, setSessionLoading,
    maintenanceCheckEnabled, setMaintenanceCheckEnabled,
    updateMaintenanceCheckEnabled,
    loading, setLoading,
    hasMoreOrders, setHasMoreOrders,
    productionData,
    serverProductionData, setServerProductionData,

    // Route info
    path,
    normalizedPath,
    realtimeProfile,
    routeDataTables,
    routeHasTable,
    needsProductionSummary,
    isPublicDataRoute,
    getInitialFetchDelayMs,

    // System Refs
    lastSyncTimestampRef,
    fullFetchInFlightRef,
    currentUserIdRef,
    initialFetchCompletedUserIdRef,
    initialFetchScheduleRef,
    productionSummaryInFlightRef,
    moduleLoadInFlightRef,
    targetRefreshInFlightRef,
    targetRefreshLastRef,
    nomenclaturesLoadedRef,
    bomItemsLoadedRef,
    nomenclaturesRef,
    bomItemsRef,
    ordersRef,
    tasksRef,
    inventoryRef,
    workCardHistoryRef,
    receptionDocsRef,
    purchaseRequestsRef,
    companyStructureRef,
    companyPositionsRef,
    systemUsersRef,
    machinesRef,
    normalizedPathRef,
    cacheTimerRef,
    matReqPushBufferRef,
    lastVisibilityRefreshRef,
    initialFetchTimerRef,
    visibilityRefreshTimerRef,

    // Operations
    performIncrementalCatchUp
  }
}
