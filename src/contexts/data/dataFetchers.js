import { supabase } from '../../supabase.js'
import {
  fetchFulfillmentTasks,
  fetchMissingOrdersForTasks,
  isFulfillmentRoute
} from '../../services/fulfillmentQueueService.js'
import { fetchProductionSummary } from '../../services/statisticsService.js'
import {
  getTaskDataProfileKey,
  fetchOperationalTasks,
  fetchActiveTasksOnly,
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

const PAGE_SIZE = 20

export function useDataFetchers(state) {
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
    currentUserIdRef
  } = state

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x').replace(/[іi]/g, 'i').replace(/[уy]/g, 'y')
    .replace(/[кk]/g, 'k').replace(/[мm]/g, 'm').replace(/[нn]/g, 'n')
    .replace(/[вv]/g, 'v').replace(/[и]/g, 'y').replace(/\s/g, '')

  const getTargetRefreshKey = (tableName) => {
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

    const operationalResult = await fetchActiveTasksOnly()
    if (operationalResult.error) return operationalResult

    return {
      data: mergeTaskRows(operationalResult.data || [], fulfillmentResult.data || []),
      error: null,
      source: fulfillmentResult.source,
      profileKey
    }
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
        const taskResult = await fetchTasksForCurrentRoute()
        const data = requireData(taskResult)
        if (taskResult.profileKey !== getTaskDataProfileKey(normalizedPathRef?.current || normalizedPath)) return
        if (data) {
          const hydrationResult = await hydrateOrdersForTaskRows(data)
          if (hydrationResult.error) throw hydrationResult.error
          setTasks(prev => {
            return isFulfillmentRoute(normalizedPath)
              ? reconcileFulfillmentTaskRows(prev, data, normalizedPath)
              : mergeTaskRows(prev, data)
          })
        }
      } else if (tableName === 'orders') {
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
        const data = requireData(await supabase.from('management_tasks').select('*').or('status.neq.done,project_id.not.is.null').order('created_at', { ascending: false }))
        try {
          const statusUpdates = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
          const createdTasks = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')

          const map = new Map()
          if (Array.isArray(data)) {
            data.forEach(t => map.set(t.id, statusUpdates[t.id] ? { ...t, ...statusUpdates[t.id] } : t))
          }
          if (Array.isArray(createdTasks)) {
            createdTasks.forEach(t => {
              if (!map.has(t.id)) map.set(t.id, statusUpdates[t.id] ? { ...t, ...statusUpdates[t.id] } : t)
            })
          }
          const merged = Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
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
          needsTable('system_users') ? supabase.from('system_users').select('id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar, last_seen, shift_calendar').order('login') : skippedTable(),
          needsTable('machines') ? supabase.from('machines').select('*').order('name') : skippedTable(),
          needsTable('management_tasks') ? supabase.from('management_tasks').select('*').or('status.neq.done,project_id.not.is.null').order('created_at', { ascending: false }) : skippedTable(),
          needsTable('task_projects') ? supabase.from('task_projects').select('*').order('created_at', { ascending: false }) : skippedTable(),
          needsTable('customers') ? supabase.from('customers').select('*').limit(500).order('name') : skippedTable(),
          needsTable('orders') ? supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).range(0, 99) : skippedTable(),
          needsTable('tasks') ? fetchTasksForCurrentRoute() : skippedTable(),
          !needsTable('nomenclatures') ? skippedTable() : nomenclaturesLoadedRef.current ? Promise.resolve({ data: nomenclaturesRef.current }) : supabase.from('nomenclatures').select('*').limit(2000).then(res => { if (!res.error && Array.isArray(res.data)) nomenclaturesLoadedRef.current = true; return res }),
          !needsTable('bom_items') ? skippedTable() : bomItemsLoadedRef.current ? Promise.resolve({ data: bomItemsRef.current }) : supabase.from('bom_items').select('*').limit(4000).then(res => { if (!res.error && Array.isArray(res.data)) bomItemsLoadedRef.current = true; return res }),
          needsTable('work_cards') ? fetchActiveWorkCards() : skippedTable(),
          !needsTable('company_structure') ? skippedTable() : companyStructureRef.current.length > fallbackStructure.length ? Promise.resolve({ data: companyStructureRef.current }) : supabase.from('company_structure').select('*').order('name').then(res => res, () => ({ data: fallbackStructure, error: null })),
          !needsTable('company_positions') ? skippedTable() : companyPositionsRef.current.length > fallbackPositions.length ? Promise.resolve({ data: companyPositionsRef.current }) : supabase.from('company_positions').select('*').order('name').then(res => res, () => ({ data: fallbackPositions, error: null })),
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

        const taskProfileIsCurrent = !taskProfileKey || taskProfileKey === getTaskDataProfileKey(normalizedPathRef?.current || normalizedPath)
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
        if (mt) {
          try {
            const statusUpdates = JSON.parse(localStorage.getItem('centrum_task_status_updates') || '{}')
            const createdTasks = JSON.parse(localStorage.getItem('centrum_created_management_tasks') || '[]')
            const map = new Map()
            mt.forEach(tRow => map.set(tRow.id, statusUpdates[tRow.id] ? { ...tRow, ...statusUpdates[tRow.id] } : tRow))
            createdTasks.forEach(tRow => {
              if (!map.has(tRow.id)) map.set(tRow.id, statusUpdates[tRow.id] ? { ...tRow, ...statusUpdates[tRow.id] } : tRow)
            })
            setManagementTasks(Array.from(map.values()).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)))
          } catch {
            setManagementTasks(mt)
          }
        }
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

  const fetchData = async (forceOrTargets = false) => {
    if (typeof forceOrTargets === 'string' || Array.isArray(forceOrTargets)) {
      const targets = [...new Set((Array.isArray(forceOrTargets) ? forceOrTargets : [forceOrTargets])
        .map(tableName => tableName === 'requests' ? 'material_requests' : tableName))]

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

    if (forceOrTargets !== true) return fetchData(routeDataTables)

    routeDataTables.forEach(tableName => {
      targetRefreshLastRef.current[getTargetRefreshKey(tableName)] = 0
    })
    return fetchData(routeDataTables)
  }

  const fetchTaskPlanSnapshot = async (taskId) => {
    if (!taskId) return null
    try {
      const cached = tasksRef.current.find(t => t.id === taskId)
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

  const fetchModuleData = async (moduleName) => {
    const key = String(moduleName || '').toLowerCase()
    if (!key) return
    if (moduleLoadInFlightRef.current[key]) return moduleLoadInFlightRef.current[key]

    const request = (async () => {
      if (key === 'master') {
        targetRefreshLastRef.current['orders'] = 0
        targetRefreshLastRef.current[getTargetRefreshKey('tasks')] = 0
        targetRefreshLastRef.current['inventory'] = 0
        targetRefreshLastRef.current['material_requests'] = 0
        await Promise.all([
          refreshTable('orders'),
          refreshTable('tasks'),
          refreshTable('inventory'),
          refreshTable('material_requests')
        ])
        await refreshProductionSummary()
      } else if (key === 'foreman') {
        targetRefreshLastRef.current[getTargetRefreshKey('tasks')] = 0
        await refreshTable('tasks')
        if (path.includes('foreman-dashboard')) {
          await fetchData(['work_card_scrap_totals', 'work_card_flow_totals'])
        }
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
    } catch { return [] }
  }

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

  return {
    normalize,
    fetchOrders,
    fetchData,
    fetchCritical,
    fetchModuleData,
    refreshProductionSummary,
    fetchTaskPlanSnapshot,
    fetchHistoryRange,
    fetchTaskArchiveCards,
    fetchCompletedManagementTasks,
    fetchCompletedManagementTasksCount,
    refreshTable,
    upsertCompanyStructure,
    deleteCompanyStructure,
    upsertCompanyPosition,
    deleteCompanyPosition,
    fetchTasksForCurrentRoute,
    getTargetRefreshKey,
    hydrateOrdersForTaskRows
  }
}
