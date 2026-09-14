import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createStableFetcherFacade } from '../src/contexts/data/stableFetchers.js'

const fetcherSource = readFileSync(new URL('../src/contexts/data/dataFetchers.ts', import.meta.url), 'utf8')
const lifecycleSource = readFileSync(new URL('../src/contexts/data/dataLifecycle.js', import.meta.url), 'utf8')
const stateSource = readFileSync(new URL('../src/contexts/data/dataState.ts', import.meta.url), 'utf8')
const serviceWorkerSource = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')

describe('egress lifecycle regression guard', () => {
  it('keeps callback identities stable while dispatching to the latest implementation', () => {
    const first = vi.fn(() => 'first')
    const second = vi.fn(() => 'second')
    let latest = { fetchData: first }
    const facade = createStableFetcherFacade(() => latest, ['fetchData'])
    const stableReference = facade.fetchData

    expect(facade.fetchData()).toBe('first')
    latest = { fetchData: second }
    expect(facade.fetchData).toBe(stableReference)
    expect(facade.fetchData()).toBe('second')
  })

  it('does not bypass table TTL unless the caller explicitly forces a refresh', () => {
    expect(fetcherSource).toContain('const force = options.force === true')
    expect(fetcherSource).toContain('triggerTargetedRefresh(table, force)')
    expect(fetcherSource).not.toContain('triggerTargetedRefresh(table, true)')
  })

  it('does not download the global active-task set on scoped fulfillment routes', () => {
    const fulfillmentBranch = fetcherSource.slice(
      fetcherSource.indexOf('const fetchTasksForCurrentRoute'),
      fetcherSource.indexOf('const hydrateOrdersForTaskRows')
    )
    expect(fulfillmentBranch).not.toContain('fetchActiveTasksOnly()')
    expect(fulfillmentBranch).toContain('fetchFulfillmentTasks(supabase, normalizedPath)')
  })

  it('uses Map access consistently for refresh timestamps', () => {
    expect(lifecycleSource).toContain('targetRefreshLastRef.current.get(')
    expect(lifecycleSource).not.toContain('targetRefreshLastRef.current[')
  })

  it('memoizes the route table predicate used by realtime effects', () => {
    expect(stateSource).toContain('const routeHasTable = useCallback(')
  })

  it('completes the initial fetch instead of retrying it forever', () => {
    expect(stateSource).toContain('const getInitialFetchDelayMs = useCallback(')
    expect(fetcherSource).toContain('initialFetchCompletedUserIdRef.current = currentUserIdRef.current')
  })

  it('rolls the emergency service worker across every open application route', () => {
    expect(serviceWorkerSource).toContain("const CACHE_NAME = 'centrum-v5'")
    expect(serviceWorkerSource).toContain('clientUrl.origin === self.location.origin')
    expect(serviceWorkerSource).not.toContain("clientUrl.pathname === '/' || clientUrl.pathname === '/login'")
  })
})
