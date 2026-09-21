import { supabase } from '../../supabase.js'
import {
  fetchFulfillmentTasks,
  fetchMissingOrdersForTasks,
  isFulfillmentRoute
} from '../../services/fulfillmentQueueService.js'
import { fetchProductionSummary } from '../../services/statisticsService.js'
import {
  getTaskDataProfileKey,
  getRouteDataTables,
  fetchOperationalTasks,
  fetchActiveWorkCards,
  fetchOperationalMaterialRequests,
  fetchPendingMachineCalls,
  fetchWorkCardScrapTotals,
  fetchWorkCardFlowTotals,
  mergeTaskRows,
  mergeOrderRows,
  reconcileFulfillmentTaskRows,
  TARGET_REFRESH_TTL_BY_TABLE,
  TARGET_REFRESH_TTL_MS,
  fallbackStructure,
  fallbackPositions,
  OPERATOR_REALTIME_ROUTES
} from './dataProfiles.js'
import { mapV2ToStandardNom } from '../../modules/Nomenclature/utils/nomenclatureHelpers.js'

const PAGE_SIZE = 20

export interface FetchOrdersOptions {
  searchQuery?: string
  dateRange?: string
}

export function useDataFetchers(state: any) {
  const {
    // States & Setters
    setOrders,
    setCustomers,
    setInventory,
    setTasks,
    setManagementTasks,
    setTaskProjects,
    setRequests,
    setNomenclatures,
    setBomItems,
    setReceptionDocs,
    setPurchaseRequests,
    setWorkCards,
    setWorkCardHistory,
    setWorkCardScrapTotals,
    setWorkCardFlowTotals,
    setMachines,
    setSystemUsers,
    setMachineOperations,
    setMachineCalls,
    setLoading,
    setHasMoreOrders,
    setCompanyStructure,
    setCompanyPositions,
    setServerProductionData,

    // Current route & environment
    path,
    normalizedPath,
    routeDataTables,
    currentUser,
    getInitialFetchDelayMs,

    // Refs
    ordersRef,
    tasksRef,
    workCardHistoryRef,
    companyStructureRef,
    companyPositionsRef,
    nomenclaturesRef,
    bomItemsRef,
    nomenclaturesLoadedRef,
    bomItemsLoadedRef,
    normalizedPathRef,
    targetRefreshInFlightRef,
    targetRefreshLastRef,
    moduleLoadInFlightRef,
    productionSummaryInFlightRef,
    fullFetchInFlightRef,
    initialFetchCompletedUserIdRef,
    currentUserIdRef,
    lastSyncTimestampRef
  } = state

  const normalize = (s: string) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x').replace(/[іi]/g, 'i').replace(/[уy]/g, 'y')
    .replace(/[кk]/g, 'k').replace(/[мm]/g, 'm').replace(/[нn]/g, 'n')
    .replace(/[вv]/g, 'v').replace(/[и]/g, 'y').replace(/\s/g, '')

  const getTargetRefreshKey = (tableName: string) => {
    if (tableName !== 'tasks') return tableName
    return getTaskDataProfileKey(normalizedPath)
  }

  const fetchTasksForCurrentRoute = async () => {
    const profileKey = getTaskDataProfileKey(normalizedPath)
    if (!isFulfillmentRoute(normalizedPath)) {
      const daysCompleted = OPERATOR_REALTIME_ROUTES.has(normalizedPath) ? 3 : 7
      const result = await fetchOperationalTasks({ daysCompleted })
      return { ...result, profileKey }
    }

    const fulfillmentResult = await fetchFulfillmentTasks(supabase, normalizedPath)
    if (fulfillmentResult.error) return fulfillmentResult

    return {
      data: fulfillmentResult.data || [],
      error: null,
      source: fulfillmentResult.source,
      profileKey
    }
  }

  const hydrateOrdersForTaskRows = async (taskRows: any[], knownOrders = ordersRef.current) => {
    if (!isFulfillmentRoute(normalizedPath) || !Array.isArray(taskRows) || taskRows.length === 0) {
      return { data: [], error: null }
    }

    const result = await fetchMissingOrdersForTasks(supabase, taskRows, knownOrders)
    if (result.data?.length) {
      setOrders((prev: any[]) => mergeOrderRows(prev, result.data))
    }
    return result
  }

  const fetchOrders = async (page = 0, append = false, options: FetchOrdersOptions = {}) => {
    const { searchQuery, dateRange } = options
    let query = supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false })

    if (searchQuery) query = query.or(`order_num.ilike.%${searchQuery}%,customer.ilike.%${searchQuery}%`)

    if (dateRange && dateRange !== 'all') {
      const now = new Date()
      let gteDate: Date | null = null
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
      setOrders((prev: any[]) => {
        const existingIds = new Set(prev.map(o => o.id))
        const newData = (data || []).filter(o => !existingIds.has(o.id))
        return [...prev, ...newData]
      })
    } else { setOrders(data || []) }
    setHasMoreOrders((data || []).length === PAGE_SIZE)
  }

  const fetchUnifiedNomenclatures = async () => {
    try {
      const [v1Res, v2Res] = await Promise.all([
        supabase.from('nomenclatures').select('*').limit(2000),
        supabase.from('nomenclatures_v2').select('*').limit(2000)
      ])
      const v1Data = (v1Res && !v1Res.error && Array.isArray(v1Res.data)) ? v1Res.data : []
      const v2Data = (v2Res && !v2Res.error && Array.isArray(v2Res.data)) ? v2Res.data : []

      // 1. Load canonical V2 nomenclatures first (Master Catalog)
      const unifiedMap = new Map()
      const v2ById = new Map()
      const v2ByName = new Map()
      const v2ByCode = new Map()

      for (const n of v2Data) {
        if (n && n.id) {
          const mapped = mapV2ToStandardNom(n)
          mapped.legacy_ids = [String(n.id)]
          unifiedMap.set(String(n.id), mapped)
          v2ById.set(String(n.id), mapped)

          const normName = String(mapped.name || '').trim().toLowerCase()
          if (normName) v2ByName.set(normName, mapped)

          const normCode = String(mapped.nomenclature_code || mapped.code || '').trim().toUpperCase()
          if (normCode) v2ByCode.set(normCode, mapped)
        }
      }

      // 2. Process legacy V1 data: merge duplicates into canonical V2, keep only truly unique legacy items
      const v1ByName = new Map()
      for (const n of v1Data) {
        if (!n || !n.id) continue
        const normName = String(n.name || '').trim().toLowerCase()
        const normCode = String(n.nomenclature_code || n.code || '').trim().toUpperCase()
        const legacyIdStr = String(n.id)

        const canonicalV2 = v2ById.get(legacyIdStr)
          || (normName && v2ByName.get(normName)) || (normCode && v2ByCode.get(normCode))

        if (canonicalV2) {
          if (!canonicalV2.legacy_ids.includes(legacyIdStr)) {
            canonicalV2.legacy_ids.push(legacyIdStr)
          }
          if (!canonicalV2.material_type && n.material_type) canonicalV2.material_type = n.material_type
          if (!canonicalV2.description && n.description) canonicalV2.description = n.description
          if (!canonicalV2.additional_info && n.additional_info) canonicalV2.additional_info = n.additional_info
          if (!canonicalV2.units_per_sheet && n.units_per_sheet) canonicalV2.units_per_sheet = n.units_per_sheet
        } else {
          const existingV1 = normName ? v1ByName.get(normName) : null
          if (existingV1) {
            if (!existingV1.legacy_ids.includes(legacyIdStr)) {
              existingV1.legacy_ids.push(legacyIdStr)
            }
          } else {
            const item = { ...n, legacy_ids: [legacyIdStr] }
            unifiedMap.set(legacyIdStr, item)
            if (normName) v1ByName.set(normName, item)
          }
        }
      }

      const unifiedList: any = Array.from(unifiedMap.values())

      const legacyIdToCanonical = new Map()
      for (const item of unifiedList) {
        if (item.legacy_ids) {
          for (const legId of item.legacy_ids) {
            legacyIdToCanonical.set(String(legId), item)
          }
        }
      }

      const origFind = unifiedList.find.bind(unifiedList)
      unifiedList.find = function (predicate: any, thisArg: any) {
        const direct = origFind(predicate, thisArg)
        if (direct) return direct
        for (const [legId, item] of legacyIdToCanonical.entries()) {
          try {
            if (predicate({ ...item, id: legId }, 0, unifiedList)) {
              return item
            }
          } catch {
            // continue
          }
        }
        return undefined
      }

      return unifiedList
    } catch (err) {
      console.warn('[dataFetchers] Failed to fetch unified nomenclatures:', err)
      return nomenclaturesRef.current || []
    }
  }

  const refreshTable = async (tableName: string) => {
    try {
      const requireData = (result: any) => {
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
        const taskResult = await fetchTasksForCurrentRoute()
        const data = requireData(taskResult)
        if ((taskResult as any).profileKey !== getTaskDataProfileKey(normalizedPathRef?.current || normalizedPath)) return
        if (data) {
          setTasks((prev: any[]) => {
            return isFulfillmentRoute(normalizedPath)
              ? reconcileFulfillmentTaskRows(prev, data, normalizedPath)
              : mergeTaskRows(prev, data)
          })
          hydrateOrdersForTaskRows(data).catch(err => {
            console.warn('[dataFetchers] Background order hydration error:', err)
          })
        }
      } else if (tableName === 'orders') {
        const data = requireData(await supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 50))
        if (data) setOrders((prev: any[]) => {
          const next = [...prev]
          data.forEach((item: any) => {
            const idx = next.findIndex(o => o.id === item.id)
            if (idx >= 0) next[idx] = item
            else next.unshift(item)
          })
          return next.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
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
        const data = requireData(await supabase.from('management_tasks').select('*').or('status.neq.done,project_id.not.is.null').order('created_at', { ascending: false }))
        try {
          const statusUpdates = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
          const createdTasks = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')

          const map = new Map()
          if (Array.isArray(data)) {
            data.forEach((t: any) => map.set(t.id, statusUpdates[t.id] ? { ...t, ...statusUpdates[t.id] } : t))
          }
          if (Array.isArray(createdTasks)) {
            createdTasks.forEach((t: any) => {
              if (!map.has(t.id)) map.set(t.id, statusUpdates[t.id] ? { ...t, ...statusUpdates[t.id] } : t)
            })
          }
          const merged = Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          setManagementTasks(merged)
        } catch {
          if (data) setManagementTasks(data)
        }
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
      } else if (tableName === 'nomenclatures' || tableName === 'nomenclatures_v2') {
        const data = await fetchUnifiedNomenclatures()
        if (data && data.length > 0) {
          nomenclaturesRef.current = data
          setNomenclatures(data)
          nomenclaturesLoadedRef.current = true
        }
      } else if (tableName === 'bom_items') {
        const data = requireData(await supabase.from('bom_items').select('*').limit(4000))
        if (data) {
          bomItemsRef.current = data
          setBomItems(data)
          bomItemsLoadedRef.current = true
        }
      } else if (tableName === 'customers') {
        const data = requireData(await supabase.from('customers').select('*').order('name').limit(500))
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
          .filter((task: any) => task.status !== 'completed' || new Date(task.completed_at || task.updated_at || 0).getTime() > recentCutoff)
          .map((task: any) => task.id)
          .filter(Boolean)
        const data = requireData(await fetchWorkCardScrapTotals(relevantTaskIds))
        if (data) setWorkCardScrapTotals(data)
      } else if (tableName === 'work_card_flow_totals') {
        const recentCutoff = Date.now() - 3 * 24 * 60 * 60 * 1000
        const relevantTaskIds = tasksRef.current
          .filter((task: any) => task.status !== 'completed' || new Date(task.completed_at || task.updated_at || 0).getTime() > recentCutoff)
          .map((task: any) => task.id)
          .filter(Boolean)
        const data = requireData(await fetchWorkCardFlowTotals(relevantTaskIds))
        if (data) setWorkCardFlowTotals(data)
      } else {
        throw new Error(`Unsupported refresh table: ${tableName}`)
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mes:refresh-table', { detail: { table: tableName } }))
      }
    } catch (e) {
      console.warn(`[dataFetchers] Failed to refresh table ${tableName}:`, e)
    }
  }

  const triggerTargetedRefresh = async (tableName: string, force = false) => {
    const key = getTargetRefreshKey(tableName)
    const now = Date.now()
    const lastTime = targetRefreshLastRef.current.get(key) || 0
    const ttlMs = (TARGET_REFRESH_TTL_BY_TABLE as Record<string, number>)[tableName] || TARGET_REFRESH_TTL_MS

    if (!force && lastTime > 0 && (now - lastTime) < ttlMs) {
      return
    }

    if (targetRefreshInFlightRef.current.has(key)) {
      return
    }

    targetRefreshInFlightRef.current.add(key)
    try {
      await refreshTable(tableName)
      targetRefreshLastRef.current.set(key, Date.now())
    } finally {
      targetRefreshInFlightRef.current.delete(key)
    }
  }

  const fetchData = async (tables: string | string[] = [], options: { force?: boolean } = {}) => {
    const tableList = typeof tables === 'string' ? [tables] : (Array.isArray(tables) ? tables : [])
    if (tableList.length === 0) return
    const force = options.force === true
    const promises = tableList.map(table => triggerTargetedRefresh(table, force))
    await Promise.allSettled(promises)
  }

  const fetchCritical = async () => {
    const criticalTables = routeDataTables && routeDataTables.length > 0 ? routeDataTables : ['orders', 'tasks']
    await fetchData(criticalTables)
    if (currentUserIdRef.current) {
      initialFetchCompletedUserIdRef.current = currentUserIdRef.current
    }
  }

  const fetchModuleData = async (moduleNameOrRoute?: string) => {
    const targetPath = moduleNameOrRoute
      ? (moduleNameOrRoute.startsWith('/') ? moduleNameOrRoute : `/${moduleNameOrRoute}`)
      : normalizedPath
    const tables = getRouteDataTables(targetPath)
    if (tables && tables.length > 0) {
      await fetchData(tables)
    }
  }

  const fetchTaskPlanSnapshot = async (taskId: string) => {
    if (!taskId) return null
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, step, plan_snapshot')
        .eq('id', taskId)
        .maybeSingle()
      if (!error && data && data.plan_snapshot) {
        setTasks((prev: any[]) => prev.map(t => String(t.id) === String(taskId) ? { ...t, plan_snapshot: data.plan_snapshot } : t))
      }
      return data
    } catch (err) {
      console.warn('[dataFetchers] Failed to fetch task plan snapshot:', err)
      return null
    }
  }

  const fetchHistoryRange = async (startDate: string, endDate: string) => {
    try {
      const { data, error } = await supabase
        .from('work_card_history')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('[dataFetchers] Failed to fetch history range:', err)
      return []
    }
  }

  const fetchTaskArchiveCards = async (taskId: string) => {
    if (!taskId) return []
    try {
      const { data, error } = await supabase
        .from('work_cards')
        .select('*')
        .eq('task_id', taskId)
        .order('card_perm_number')
      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('[dataFetchers] Failed to fetch task archive cards:', err)
      return []
    }
  }

  const fetchCompletedManagementTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('management_tasks')
        .select('*')
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data || []
    } catch (err) {
      console.warn('[dataFetchers] Failed to fetch completed management tasks:', err)
      return []
    }
  }

  const fetchCompletedManagementTasksCount = async () => {
    try {
      const { count, error } = await supabase
        .from('management_tasks')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'done')
      if (error) throw error
      return count || 0
    } catch (err) {
      console.warn('[dataFetchers] Failed to fetch completed management tasks count:', err)
      return 0
    }
  }

  const upsertCompanyStructure = async (node: any) => {
    try {
      const payload = { ...node }
      if (!payload.id || payload.id.length < 5) {
        delete payload.id
      }
      const { data: res, error } = await supabase.from('company_structure').upsert([payload]).select()
      if (error) throw error
      if (res && res.length > 0) {
        setCompanyStructure((prev: any[]) => {
          const idx = prev.findIndex(item => item.id === res[0].id)
          if (idx >= 0) {
            const next = [...prev]; next[idx] = res[0]; return next
          }
          return [...prev, res[0]]
        })
        return { data: res[0], error: null }
      }
      return { data: null, error: null }
    } catch (e: any) {
      console.error("Failed to upsert company structure:", e)
      const fallbackNode = { ...node }
      if (!fallbackNode.id) fallbackNode.id = String(Date.now())
      setCompanyStructure((prev: any[]) => {
        const idx = prev.findIndex(item => item.id === fallbackNode.id || item.name === fallbackNode.name)
        if (idx >= 0) {
          const next = [...prev]; next[idx] = fallbackNode; return next
        }
        return [...prev, fallbackNode]
      })
      return { data: fallbackNode, error: e }
    }
  }

  const deleteCompanyStructure = async (id: string) => {
    try {
      const { error } = await supabase.from('company_structure').delete().eq('id', id)
      if (error) throw error
      setCompanyStructure((prev: any[]) => prev.filter(item => item.id !== id))
      return { error: null }
    } catch (e: any) {
      console.error("Failed to delete company structure:", e)
      setCompanyStructure((prev: any[]) => prev.filter(item => item.id !== id))
      return { error: e }
    }
  }

  const upsertCompanyPosition = async (pos: any) => {
    try {
      const payload = { ...pos }
      if (!payload.id || payload.id.length < 5) {
        delete payload.id
      }
      let { data: res, error } = await supabase.from('company_positions').upsert([payload]).select()
      
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
        setCompanyPositions((prev: any[]) => {
          const idx = prev.findIndex(item => item.id === res[0].id)
          if (idx >= 0) {
            const next = [...prev]; next[idx] = res[0]; return next
          }
          return [...prev, res[0]]
        })
        return { data: res[0], error: null }
      }
      return { data: null, error: null }
    } catch (e: any) {
      console.error("Failed to upsert company position:", e)
      const fallbackPos = { ...pos }
      if (!fallbackPos.id) fallbackPos.id = String(Date.now())
      setCompanyPositions((prev: any[]) => {
        const idx = prev.findIndex(item => item.id === fallbackPos.id || item.name === fallbackPos.name)
        if (idx >= 0) {
          const next = [...prev]; next[idx] = fallbackPos; return next
        }
        return [...prev, fallbackPos]
      })
      return { data: fallbackPos, error: e }
    }
  }

  const deleteCompanyPosition = async (id: string) => {
    try {
      const { error } = await supabase.from('company_positions').delete().eq('id', id)
      if (error) throw error
      setCompanyPositions((prev: any[]) => prev.filter(item => item.id !== id))
      return { error: null }
    } catch (e: any) {
      console.error("Failed to delete company position:", e)
      setCompanyPositions((prev: any[]) => prev.filter(item => item.id !== id))
      return { error: e }
    }
  }

  const refreshProductionSummary = async () => {
    try {
      const summary = await fetchProductionSummary()
      if (summary) setServerProductionData(summary)
    } catch (err) {
      console.warn('[dataFetchers] Failed to refresh production summary:', err)
    }
  }

  return {
    normalize,
    fetchOrders,
    fetchUnifiedNomenclatures,
    refreshTable,
    triggerTargetedRefresh,
    fetchTasksForCurrentRoute,
    hydrateOrdersForTaskRows,
    getTargetRefreshKey,
    fetchData,
    fetchCritical,
    fetchModuleData,
    refreshProductionSummary,
    fetchTaskPlanSnapshot,
    fetchHistoryRange,
    fetchTaskArchiveCards,
    fetchCompletedManagementTasks,
    fetchCompletedManagementTasksCount,
    upsertCompanyStructure,
    deleteCompanyStructure,
    upsertCompanyPosition,
    deleteCompanyPosition
  }
}
