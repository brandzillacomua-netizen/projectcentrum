import { describe, it, expect } from 'vitest'
import * as profiles from '../src/contexts/data/dataProfiles.js'
import { useDataFetchers } from '../src/contexts/data/dataFetchers.js'

describe('useData Decomposition Parity & Structure', () => {
  it('exports all expected cache keys, profiles, and helpers from dataProfiles.js', () => {
    expect(profiles.CACHE_KEY).toBe('MES_APP_CACHE_V13')
    expect(profiles.USER_CACHE_KEY).toBe('MES_SESSION_USER')
    expect(Array.isArray(profiles.fallbackStructure)).toBe(true)
    expect(Array.isArray(profiles.fallbackPositions)).toBe(true)
    expect(typeof profiles.normalizeRoutePath).toBe('function')
    expect(typeof profiles.getRouteDataTables).toBe('function')
    expect(typeof profiles.getRealtimeProfile).toBe('function')
    expect(typeof profiles.getTaskDataProfileKey).toBe('function')
    expect(typeof profiles.mergeTaskRows).toBe('function')
    expect(typeof profiles.mergeOrderRows).toBe('function')
    expect(typeof profiles.reconcileFulfillmentTaskRows).toBe('function')
    expect(typeof profiles.fetchFulfillmentTasks).toBe('function')
    expect(typeof profiles.fetchMissingOrdersForTasks).toBe('function')
    expect(typeof profiles.fetchProductionSummary).toBe('function')
  })

  it('correctly merges task rows preserving existing snapshots', () => {
    const existing = [
      { id: 't1', step: 'Підготовка', plan_snapshot: { cuts: 5 }, created_at: '2026-01-01T00:00:00Z' }
    ]
    const incoming = [
      { id: 't1', step: 'Підготовка', plan_snapshot: null, created_at: '2026-01-01T00:00:00Z' }
    ]
    const merged = profiles.mergeTaskRows(existing, incoming)
    expect(merged.length).toBe(1)
    expect(merged[0].plan_snapshot).toEqual({ cuts: 5 })
  })

  it('correctly filters out purged order numbers in mergeOrderRows', () => {
    const existing = [
      { id: 'o1', order_num: '14082026-01', customer: 'Purged Customer', created_at: '2026-01-01T00:00:00Z' },
      { id: 'o2', order_num: 'VALID-001', customer: 'Original Customer', created_at: '2026-01-01T00:00:00Z' }
    ]
    const incoming = [
      { id: 'o1', order_num: '14082026-01', created_at: '2026-01-01T00:00:00Z' },
      { id: 'o2', order_num: 'VALID-001', note: 'Enriched Note', created_at: '2026-01-01T00:00:00Z' },
      { id: 'o3', order_num: 'VALID-002', created_at: '2026-01-02T00:00:00Z' }
    ]
    const merged = profiles.mergeOrderRows(existing, incoming)
    expect(merged.some(o => o.order_num === '14082026-01')).toBe(false)
    expect(merged.some(o => o.order_num === 'VALID-001' && o.customer === 'Original Customer' && o.note === 'Enriched Note')).toBe(true)
    expect(merged.some(o => o.order_num === 'VALID-002')).toBe(true)
  })

  it('instantiates useDataFetchers with all expected API methods', () => {
    const mockState = {
      setOrders: () => {},
      setCustomers: () => {},
      setInventory: () => {},
      setTasks: () => {},
      setManagementTasks: () => {},
      setTaskProjects: () => {},
      setRequests: () => {},
      setNomenclatures: () => {},
      setBomItems: () => {},
      setReceptionDocs: () => {},
      setPurchaseRequests: () => {},
      setWorkCards: () => {},
      setWorkCardHistory: () => {},
      setWorkCardScrapTotals: () => {},
      setWorkCardFlowTotals: () => {},
      setMachines: () => {},
      setSystemUsers: () => {},
      setMachineOperations: () => {},
      setMachineCalls: () => {},
      setLoading: () => {},
      setHasMoreOrders: () => {},
      setCompanyStructure: () => {},
      setCompanyPositions: () => {},
      setServerProductionData: () => {},
      path: '/',
      normalizedPath: '/',
      routeDataTables: ['orders', 'tasks'],
      currentUser: { id: 'usr-1' },
      getInitialFetchDelayMs: () => 0,
      ordersRef: { current: [] },
      tasksRef: { current: [] },
      workCardHistoryRef: { current: [] },
      companyStructureRef: { current: [] },
      companyPositionsRef: { current: [] },
      nomenclaturesRef: { current: [] },
      bomItemsRef: { current: [] },
      nomenclaturesLoadedRef: { current: false },
      bomItemsLoadedRef: { current: false },
      normalizedPathRef: { current: '/' },
      targetRefreshInFlightRef: { current: {} },
      targetRefreshLastRef: { current: {} },
      moduleLoadInFlightRef: { current: {} },
      productionSummaryInFlightRef: { current: null },
      fullFetchInFlightRef: { current: null },
      initialFetchCompletedUserIdRef: { current: null },
      currentUserIdRef: { current: 'usr-1' }
    }

    const fetchers = useDataFetchers(mockState)

    const expectedMethods = [
      'normalize',
      'fetchOrders',
      'fetchData',
      'fetchCritical',
      'fetchModuleData',
      'refreshProductionSummary',
      'fetchTaskPlanSnapshot',
      'fetchHistoryRange',
      'fetchTaskArchiveCards',
      'fetchCompletedManagementTasks',
      'fetchCompletedManagementTasksCount',
      'refreshTable',
      'upsertCompanyStructure',
      'deleteCompanyStructure',
      'upsertCompanyPosition',
      'deleteCompanyPosition',
      'fetchTasksForCurrentRoute',
      'getTargetRefreshKey',
      'hydrateOrdersForTaskRows'
    ]

    expectedMethods.forEach(method => {
      expect(typeof fetchers[method]).toBe('function')
    })
  })
})
