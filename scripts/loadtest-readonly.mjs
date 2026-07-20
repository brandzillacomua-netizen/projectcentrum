/**
 * Sustained, read-only load test for a staging Supabase project.
 *
 * Required:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, MES_SECRET
 *   LOAD_TEST_CONFIRM=STAGING_READ_ONLY
 *
 * Common options:
 *   LOAD_USERS=50
 *   LOAD_DURATION_SEC=120
 *   LOAD_THINK_MIN_MS=1500
 *   LOAD_THINK_MAX_MS=3500
 *   LOAD_PROFILE_MIX=shop1:15,warehouse_boxes:8,warehouse:5,master:5,foreman:5,packaging:4,manager:3,dashboard:2,shipping:2,chat:1
 *   LOAD_P95_LIMIT_MS=2000
 *   LOAD_P99_LIMIT_MS=5000
 *   LOAD_MAX_ERROR_RATE_PCT=0
 *
 * Optional Realtime (explicit opt-in; subscriptions only, no broadcasts):
 *   LOAD_REALTIME=I_UNDERSTAND_READ_ONLY
 *   LOAD_REALTIME_USERS=50
 *   LOAD_REALTIME_TABLES=tasks,work_cards,material_requests
 *
 * The script has no mutation endpoints. POST is permitted only for explicitly
 * allow-listed STABLE aggregate/queue RPCs. The known production project is
 * blocked unless a separate emergency override is set.
 */

const PRODUCTION_PROJECT_REF = 'hurzutjytlcvtbvihnry'
const STAGING_CONFIRMATION = 'STAGING_READ_ONLY'
const REALTIME_CONFIRMATION = 'I_UNDERSTAND_READ_ONLY'
const DEFAULT_PROFILE_MIX = 'shop1:15,warehouse_boxes:8,warehouse:5,master:5,foreman:5,packaging:4,manager:3,dashboard:2,shipping:2,chat:1'
const SAFE_READ_ONLY_RPC_PATHS = new Set([
  '/rest/v1/rpc/mes_production_summary',
  '/rest/v1/rpc/mes_fulfillment_queue'
])

const wait = ms => new Promise(resolve => setTimeout(resolve, ms))

const readNumber = (name, fallback, { min, max, integer = false } = {}) => {
  const raw = process.env[name]
  const value = raw == null || raw === '' ? fallback : Number(raw)
  if (!Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw new Error(`${name} must be ${integer ? 'an integer' : 'a number'}.`)
  }
  if (min != null && value < min) throw new Error(`${name} must be >= ${min}.`)
  if (max != null && value > max) throw new Error(`${name} must be <= ${max}.`)
  return value
}

const baseUrl = String(process.env.SUPABASE_URL || '').replace(/\/$/, '')
const anonKey = String(process.env.SUPABASE_ANON_KEY || '')
const mesSecret = String(process.env.MES_SECRET || '')

if (!baseUrl || !anonKey || !mesSecret) {
  throw new Error('Set SUPABASE_URL, SUPABASE_ANON_KEY and MES_SECRET for a staging project.')
}

let targetUrl
try {
  targetUrl = new URL(baseUrl)
} catch {
  throw new Error('SUPABASE_URL must be an absolute URL.')
}

const isLocalTarget = ['localhost', '127.0.0.1', '::1'].includes(targetUrl.hostname)
if (targetUrl.protocol !== 'https:' && !isLocalTarget) {
  throw new Error('SUPABASE_URL must use HTTPS (except localhost).')
}
if (!isLocalTarget && process.env.LOAD_TEST_CONFIRM !== STAGING_CONFIRMATION) {
  throw new Error(`Set LOAD_TEST_CONFIRM=${STAGING_CONFIRMATION} after confirming the target is staging.`)
}
if (baseUrl.includes(PRODUCTION_PROJECT_REF) && process.env.ALLOW_PRODUCTION_LOAD_TEST !== 'I_UNDERSTAND') {
  throw new Error('Production load testing is blocked. Use a staging clone.')
}

const jwtPayload = (() => {
  try {
    const encoded = anonKey.split('.')[1]
    if (!encoded) return null
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
  } catch {
    return null
  }
})()
if (jwtPayload?.role === 'service_role') {
  throw new Error('SUPABASE_ANON_KEY must not be a service_role key.')
}

const users = readNumber('LOAD_USERS', 50, { min: 1, max: 200, integer: true })
const durationSec = readNumber('LOAD_DURATION_SEC', 120, { min: 10, max: 1800, integer: true })
const thinkMinMs = readNumber('LOAD_THINK_MIN_MS', 1500, { min: 250, max: 60000, integer: true })
const thinkMaxMs = readNumber('LOAD_THINK_MAX_MS', 3500, { min: 250, max: 60000, integer: true })
const requestTimeoutMs = readNumber('LOAD_REQUEST_TIMEOUT_MS', 12000, { min: 1000, max: 60000, integer: true })
const progressEverySec = readNumber('LOAD_PROGRESS_SEC', 15, { min: 0, max: 300, integer: true })
const p95LimitMs = readNumber('LOAD_P95_LIMIT_MS', 2000, { min: 1, max: 60000 })
const p99LimitMs = readNumber('LOAD_P99_LIMIT_MS', 5000, { min: 1, max: 60000 })
const maxErrorRatePct = readNumber('LOAD_MAX_ERROR_RATE_PCT', 0, { min: 0, max: 100 })
const max5xx = readNumber('LOAD_MAX_5XX', 0, { min: 0, max: 1000000, integer: true })
const maxTimeouts = readNumber('LOAD_MAX_TIMEOUTS', 0, { min: 0, max: 1000000, integer: true })
const minRequestsPerUser = readNumber('LOAD_MIN_REQUESTS_PER_USER', 10, { min: 1, max: 100000, integer: true })
const minSteadyRequestsPerUser = readNumber('LOAD_MIN_STEADY_REQUESTS_PER_USER', 3, { min: 0, max: 100000, integer: true })
const startSkewLimitMs = readNumber('LOAD_START_SKEW_LIMIT_MS', 1000, { min: 1, max: 30000 })
const minConcurrency = readNumber('LOAD_MIN_CONCURRENCY', Math.max(1, Math.ceil(users * 0.8)), {
  min: 1,
  max: users,
  integer: true
})

if (thinkMinMs > thinkMaxMs) throw new Error('LOAD_THINK_MIN_MS must be <= LOAD_THINK_MAX_MS.')
if (p95LimitMs > p99LimitMs) throw new Error('LOAD_P95_LIMIT_MS must be <= LOAD_P99_LIMIT_MS.')

const realtimeRaw = String(process.env.LOAD_REALTIME || '')
if (realtimeRaw && realtimeRaw !== REALTIME_CONFIRMATION) {
  throw new Error(`LOAD_REALTIME must equal ${REALTIME_CONFIRMATION} to enable read-only subscriptions.`)
}
const realtimeEnabled = realtimeRaw === REALTIME_CONFIRMATION
const realtimeUsers = realtimeEnabled
  ? readNumber('LOAD_REALTIME_USERS', Math.min(users, 10), { min: 1, max: users, integer: true })
  : 0
const realtimeSubscribeTimeoutMs = realtimeEnabled
  ? readNumber('LOAD_REALTIME_SUBSCRIBE_TIMEOUT_MS', 15000, { min: 1000, max: 60000, integer: true })
  : 0
const realtimeTables = realtimeEnabled
  ? [...new Set(String(process.env.LOAD_REALTIME_TABLES || '').split(',').map(value => value.trim()).filter(Boolean))]
  : []

if (realtimeEnabled && realtimeTables.length === 0) {
  throw new Error('Set LOAD_REALTIME_TABLES explicitly when Realtime testing is enabled.')
}
for (const table of realtimeTables) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`Invalid Realtime table name: ${table}`)
}

const select = value => encodeURIComponent(value)
const recentTaskCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

const makeRead = (name, path, options = {}) => Object.freeze({
  name,
  path,
  method: options.method || 'GET',
  body: options.body || null,
  readOnlyRpc: options.readOnlyRpc === true
})

const REQUESTS = Object.freeze({
  system_users: makeRead('system_users', `/rest/v1/system_users?select=${select('id,login,first_name,last_name,position,access_rights,department,shift,last_seen')}&order=login.asc`),
  machines: makeRead('machines', '/rest/v1/machines?select=*&order=name.asc&limit=500'),
  orders_recent: makeRead('orders_recent', `/rest/v1/orders?select=${select('*,order_items(*)')}&order=created_at.desc&limit=100`),
  tasks_operational: makeRead('tasks_operational', `/rest/v1/tasks?select=*&or=${encodeURIComponent(`(status.neq.completed,completed_at.gte.${recentTaskCutoff})`)}&order=created_at.desc&limit=500`),
  nomenclatures: makeRead('nomenclatures', '/rest/v1/nomenclatures?select=*&limit=2000'),
  bom_items: makeRead('bom_items', '/rest/v1/bom_items?select=*&limit=1000'),
  work_cards_active: makeRead('work_cards_active', '/rest/v1/work_cards?select=*&status=neq.completed&order=created_at.desc&limit=500'),
  work_card_history_recent: makeRead('work_card_history_recent', '/rest/v1/work_card_history?select=*&order=created_at.desc&limit=500'),
  inventory: makeRead('inventory', '/rest/v1/inventory?select=*&order=name.asc&limit=1000'),
  material_requests_active: makeRead('material_requests_active', '/rest/v1/material_requests?select=*&status=neq.completed&order=created_at.desc&limit=500'),
  material_requests_recent_completed: makeRead('material_requests_recent_completed', '/rest/v1/material_requests?select=*&status=eq.completed&order=created_at.desc&limit=1000'),
  reception_docs: makeRead('reception_docs', '/rest/v1/reception_docs?select=*&order=created_at.desc&limit=300'),
  purchase_requests: makeRead('purchase_requests', '/rest/v1/purchase_requests?select=*&order=created_at.desc&limit=300'),
  machine_operations: makeRead('machine_operations', '/rest/v1/machine_operations?select=*&limit=1000'),
  machine_calls_pending: makeRead('machine_calls_pending', '/rest/v1/machine_calls?select=*&status=eq.pending&order=created_at.desc&limit=200'),
  customers: makeRead('customers', `/rest/v1/customers?select=${select('id,name,official_name')}&order=name.asc&limit=500`),
  chat_threads: makeRead('chat_threads', '/rest/v1/chat_threads?select=*&is_archived=eq.false&order=updated_at.desc&limit=100'),
  chat_participants: makeRead('chat_participants', `/rest/v1/chat_participants?select=${select('id,thread_id,user_id,last_read_at,created_at')}&order=created_at.desc&limit=200`),
  production_summary: makeRead('production_summary', '/rest/v1/rpc/mes_production_summary', {
    method: 'POST',
    body: JSON.stringify({ p_from: null, p_to: null }),
    readOnlyRpc: true
  }),
  fulfillment_packaging: makeRead('fulfillment_packaging', '/rest/v1/rpc/mes_fulfillment_queue', {
    method: 'POST',
    body: JSON.stringify({ p_queue: 'packaging', p_open_batch_limit: 300, p_archive_batch_limit: 60 }),
    readOnlyRpc: true
  }),
  fulfillment_shipping: makeRead('fulfillment_shipping', '/rest/v1/rpc/mes_fulfillment_queue', {
    method: 'POST',
    body: JSON.stringify({ p_queue: 'shipping', p_open_batch_limit: 300, p_archive_batch_limit: 20 }),
    readOnlyRpc: true
  })
})

for (const request of Object.values(REQUESTS)) {
  const requestUrl = new URL(request.path, targetUrl)
  if (requestUrl.origin !== targetUrl.origin) throw new Error(`Cross-origin request is forbidden: ${request.name}`)
  if (!['GET', 'HEAD'].includes(request.method)) {
    const safeReadOnlyRpc = request.method === 'POST'
      && request.readOnlyRpc
      && SAFE_READ_ONLY_RPC_PATHS.has(requestUrl.pathname)
    if (!safeReadOnlyRpc) throw new Error(`Mutation-capable request is forbidden: ${request.name}`)
  }
}

const makeProfile = (route, bootstrap, steady) => Object.freeze({ route, bootstrap, steady })
const PROFILES = Object.freeze({
  shop1: makeProfile('/shop1', [
    'system_users', 'machines', 'orders_recent', 'tasks_operational', 'nomenclatures', 'bom_items',
    'work_cards_active', 'inventory', 'material_requests_active', 'material_requests_recent_completed',
    'work_card_history_recent', 'machine_operations'
  ], ['work_cards_active', 'tasks_operational', 'material_requests_active', 'inventory', 'work_card_history_recent']),
  warehouse_boxes: makeProfile('/warehouse-boxes', [
    'orders_recent', 'tasks_operational', 'nomenclatures', 'work_cards_active', 'inventory',
    'material_requests_active', 'material_requests_recent_completed', 'machine_operations'
  ], ['material_requests_active', 'work_cards_active', 'inventory', 'tasks_operational']),
  warehouse: makeProfile('/warehouse', [
    'system_users', 'orders_recent', 'tasks_operational', 'nomenclatures', 'work_cards_active', 'inventory',
    'material_requests_active', 'material_requests_recent_completed', 'reception_docs', 'purchase_requests',
    'machine_operations'
  ], ['material_requests_active', 'inventory', 'reception_docs', 'purchase_requests', 'tasks_operational']),
  master: makeProfile('/master', [
    'machines', 'orders_recent', 'tasks_operational', 'nomenclatures', 'bom_items', 'inventory',
    'material_requests_active', 'material_requests_recent_completed', 'machine_calls_pending',
    'machine_operations', 'production_summary'
  ], ['orders_recent', 'tasks_operational', 'material_requests_active', 'machine_calls_pending', 'inventory']),
  foreman: makeProfile('/foreman', [
    'machines', 'orders_recent', 'tasks_operational', 'nomenclatures', 'bom_items', 'work_cards_active',
    'inventory', 'material_requests_active', 'material_requests_recent_completed', 'machine_calls_pending',
    'machine_operations'
  ], ['tasks_operational', 'work_cards_active', 'material_requests_active', 'inventory', 'machine_calls_pending']),
  packaging: makeProfile('/packaging', [
    'system_users', 'orders_recent', 'fulfillment_packaging', 'nomenclatures', 'bom_items', 'inventory',
    'material_requests_active', 'material_requests_recent_completed'
  ], ['fulfillment_packaging', 'orders_recent', 'material_requests_active', 'inventory']),
  manager: makeProfile('/manager', [
    'orders_recent', 'tasks_operational', 'nomenclatures', 'customers'
  ], ['orders_recent', 'tasks_operational', 'customers']),
  dashboard: makeProfile('/foreman-dashboard', [
    'orders_recent', 'tasks_operational', 'nomenclatures', 'bom_items', 'work_cards_active', 'inventory',
    'work_card_history_recent', 'production_summary'
  ], ['tasks_operational', 'work_cards_active', 'inventory', 'work_card_history_recent']),
  shipping: makeProfile('/shipping', [
    'system_users', 'orders_recent', 'fulfillment_shipping', 'nomenclatures'
  ], ['fulfillment_shipping', 'orders_recent']),
  chat: makeProfile('/chat', [
    'system_users', 'chat_participants', 'chat_threads'
  ], ['chat_threads', 'chat_participants'])
})

for (const [profileName, profile] of Object.entries(PROFILES)) {
  for (const requestName of [...profile.bootstrap, ...profile.steady]) {
    if (!REQUESTS[requestName]) throw new Error(`Unknown request ${requestName} in profile ${profileName}.`)
  }
}

const parseProfileMix = raw => {
  const combined = new Map()
  for (const token of String(raw || '').split(',').map(value => value.trim()).filter(Boolean)) {
    const [name, weightRaw, ...extra] = token.split(':')
    if (extra.length > 0 || !PROFILES[name]) throw new Error(`Invalid LOAD_PROFILE_MIX entry: ${token}`)
    const weight = Number(weightRaw)
    if (!Number.isInteger(weight) || weight < 1 || weight > 1000) {
      throw new Error(`Profile weight must be an integer from 1 to 1000: ${token}`)
    }
    combined.set(name, (combined.get(name) || 0) + weight)
  }
  if (combined.size === 0) throw new Error('LOAD_PROFILE_MIX must contain at least one profile.')
  return [...combined.entries()].map(([name, weight]) => ({ name, weight }))
}

const profileMix = parseProfileMix(process.env.LOAD_PROFILE_MIX || DEFAULT_PROFILE_MIX)
const profileSlots = []
const maxProfileWeight = Math.max(...profileMix.map(item => item.weight))
for (let level = 0; level < maxProfileWeight; level += 1) {
  for (const item of profileMix) {
    if (item.weight > level) profileSlots.push(item.name)
  }
}

const mulberry32 = seed => () => {
  let value = seed += 0x6D2B79F5
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

const randomBetween = (random, min, max) => Math.round(min + random() * (max - min))

const createStartBarrier = expected => {
  let ready = 0
  let releaseStart
  let resolveAllReady
  const startPromise = new Promise(resolve => { releaseStart = resolve })
  const allReadyPromise = new Promise(resolve => { resolveAllReady = resolve })
  return {
    arrive() {
      ready += 1
      if (ready === expected) resolveAllReady()
      return startPromise
    },
    waitUntilReady() {
      return allReadyPromise
    },
    release(window) {
      releaseStart(window)
    },
    get ready() {
      return ready
    }
  }
}

const results = []
const realtimeResults = []
let activeRequests = 0
let maxConcurrentRequests = 0
let stopRequested = false
let interrupted = false

const handleStop = signal => {
  if (stopRequested) return
  interrupted = true
  stopRequested = true
  console.warn(`\n${signal} received; finishing in-flight read-only requests...`)
}
process.once('SIGINT', () => handleStop('SIGINT'))
process.once('SIGTERM', () => handleStop('SIGTERM'))

const requestHeaders = Object.freeze({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'x-mes-secret': mesSecret
})

async function timedRead(request, user, phase, testStartedAt) {
  const startedAt = performance.now()
  if (user.firstRequestStartedAt == null) user.firstRequestStartedAt = startedAt
  activeRequests += 1
  maxConcurrentRequests = Math.max(maxConcurrentRequests, activeRequests)

  let status = 0
  let error = null
  let errorType = null
  let bytes = 0
  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), requestTimeoutMs)

  try {
    const response = await fetch(new URL(request.path, targetUrl), {
      method: request.method,
      headers: {
        ...requestHeaders,
        ...(request.body ? { 'Content-Type': 'application/json' } : {})
      },
      body: request.body,
      signal: abortController.signal
    })
    status = response.status
    const body = await response.arrayBuffer()
    bytes = body.byteLength
    if (!response.ok) {
      error = `HTTP ${response.status}`
      errorType = response.status >= 500 ? 'http_5xx' : 'http_4xx'
    }
  } catch (caught) {
    if (abortController.signal.aborted) {
      error = `Timeout after ${requestTimeoutMs}ms`
      errorType = 'timeout'
    } else {
      error = caught?.message || String(caught)
      errorType = 'network'
    }
  } finally {
    clearTimeout(timeout)
    activeRequests = Math.max(0, activeRequests - 1)
  }

  const result = {
    userId: user.id,
    profile: user.profileName,
    route: user.profile.route,
    phase,
    endpoint: request.name,
    status,
    error,
    errorType,
    bytes,
    startedOffsetMs: Math.round(startedAt - testStartedAt),
    durationMs: Math.round(performance.now() - startedAt)
  }
  results.push(result)
  user.requests += 1
  if (phase === 'steady') user.steadyRequests += 1
  if (error) user.failures += 1
  return result
}

let createSupabaseClient = null
if (realtimeEnabled) {
  try {
    const module = await import('@supabase/supabase-js')
    createSupabaseClient = module.createClient
  } catch (error) {
    throw new Error(`Realtime was requested but @supabase/supabase-js could not be loaded: ${error.message}`)
  }
}

function startRealtimeSession(user, testStartedAt) {
  const state = {
    userId: user.id,
    profile: user.profileName,
    subscribed: false,
    subscribedMs: null,
    subscribeTimedOut: false,
    channelErrors: 0,
    events: 0,
    statuses: {}
  }

  const client = createSupabaseClient(baseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: { 'x-mes-secret': mesSecret }
    }
  })

  let channel = client.channel(`mes-loadtest-${Date.now()}-${user.id}`)
  for (const table of realtimeTables) {
    channel = channel.on('postgres_changes', {
      event: '*',
      schema: 'public',
      table
    }, () => {
      state.events += 1
    })
  }

  let settleReady
  let readySettled = false
  const ready = new Promise(resolve => { settleReady = resolve })
  const settle = () => {
    if (readySettled) return
    readySettled = true
    settleReady()
  }
  const subscribeTimeout = setTimeout(() => {
    state.subscribeTimedOut = true
    settle()
  }, realtimeSubscribeTimeoutMs)

  channel.subscribe(status => {
    state.statuses[status] = (state.statuses[status] || 0) + 1
    if (status === 'SUBSCRIBED' && !state.subscribed) {
      state.subscribed = true
      state.subscribedMs = Math.round(performance.now() - testStartedAt)
      clearTimeout(subscribeTimeout)
      settle()
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      state.channelErrors += 1
    }
  })

  return {
    state,
    ready,
    async close() {
      await ready
      clearTimeout(subscribeTimeout)
      try {
        await Promise.race([client.removeChannel(channel), wait(3000)])
      } catch {
        state.channelErrors += 1
      }
      realtimeResults.push(state)
    }
  }
}

const virtualUsers = Array.from({ length: users }, (_, index) => {
  const profileName = profileSlots[index % profileSlots.length]
  return {
    id: index + 1,
    profileName,
    profile: PROFILES[profileName],
    random: mulberry32((index + 1) * 0x9E3779B1),
    requests: 0,
    steadyRequests: 0,
    failures: 0,
    firstRequestStartedAt: null,
    finishedAt: null
  }
})

const barrier = createStartBarrier(users)

async function runVirtualUser(user) {
  const runWindow = await barrier.arrive()
  const realtimeSession = realtimeEnabled && user.id <= realtimeUsers
    ? startRealtimeSession(user, runWindow.startedAt)
    : null

  for (const requestName of user.profile.bootstrap) {
    if (stopRequested || (performance.now() >= runWindow.deadline && user.requests > 0)) break
    await timedRead(REQUESTS[requestName], user, 'bootstrap', runWindow.startedAt)
  }

  let steadyIndex = Math.floor(user.random() * user.profile.steady.length)
  while (!stopRequested && performance.now() < runWindow.deadline) {
    const remainingBeforeThink = runWindow.deadline - performance.now()
    if (remainingBeforeThink <= 0) break
    const thinkMs = Math.min(
      randomBetween(user.random, thinkMinMs, thinkMaxMs),
      Math.max(0, remainingBeforeThink)
    )
    await wait(thinkMs)
    if (stopRequested || performance.now() >= runWindow.deadline) break

    const requestName = user.profile.steady[steadyIndex % user.profile.steady.length]
    steadyIndex += 1
    await timedRead(REQUESTS[requestName], user, 'steady', runWindow.startedAt)
  }

  user.finishedAt = performance.now()
  if (realtimeSession) await realtimeSession.close()
}

const profileDistribution = Object.entries(virtualUsers.reduce((counts, user) => {
  counts[user.profileName] = (counts[user.profileName] || 0) + 1
  return counts
}, {})).map(([profile, count]) => ({ profile, route: PROFILES[profile].route, users: count }))

console.log('Read-only staging load test configuration')
console.table([{
  target: targetUrl.host,
  users,
  durationSec,
  thinkMs: `${thinkMinMs}-${thinkMaxMs}`,
  timeoutMs: requestTimeoutMs,
  realtimeUsers,
  realtimeTables: realtimeTables.join(',') || 'disabled'
}])
console.log('Virtual-user route mix')
console.table(profileDistribution)

const userPromises = virtualUsers.map(runVirtualUser)
await barrier.waitUntilReady()

const startedAt = performance.now()
const deadline = startedAt + durationSec * 1000
console.log(`All ${barrier.ready} virtual users are ready. Releasing the start barrier now.`)
barrier.release({ startedAt, deadline })

let progressTimer = null
if (progressEverySec > 0) {
  progressTimer = setInterval(() => {
    const elapsedSec = Math.max(0.001, (performance.now() - startedAt) / 1000)
    const failures = results.filter(result => result.error).length
    console.log(`[${elapsedSec.toFixed(0)}s] requests=${results.length} rps=${(results.length / elapsedSec).toFixed(1)} active=${activeRequests} maxActive=${maxConcurrentRequests} failures=${failures}`)
  }, progressEverySec * 1000)
  progressTimer.unref?.()
}

await Promise.all(userPromises)
if (progressTimer) clearInterval(progressTimer)
const finishedAt = performance.now()

const percentile = (sorted, fraction) => {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))
  return sorted[index]
}

const summarize = rows => {
  const durations = rows.map(row => row.durationMs).sort((a, b) => a - b)
  const failures = rows.filter(row => row.error).length
  const totalBytes = rows.reduce((sum, row) => sum + row.bytes, 0)
  return {
    requests: rows.length,
    failures,
    errorRatePct: rows.length ? Number(((failures / rows.length) * 100).toFixed(2)) : 0,
    avgMs: rows.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / rows.length) : 0,
    p50Ms: percentile(durations, 0.50),
    p95Ms: percentile(durations, 0.95),
    p99Ms: percentile(durations, 0.99),
    maxMs: durations.at(-1) || 0,
    megabytes: Number((totalBytes / 1024 / 1024).toFixed(2))
  }
}

const groupSummary = (rows, key) => {
  const groups = new Map()
  for (const row of rows) {
    const value = row[key]
    if (!groups.has(value)) groups.set(value, [])
    groups.get(value).push(row)
  }
  return [...groups.entries()]
    .map(([value, groupRows]) => ({ [key]: value, ...summarize(groupRows) }))
    .sort((a, b) => String(a[key]).localeCompare(String(b[key])))
}

const overall = summarize(results)
const bootstrap = summarize(results.filter(result => result.phase === 'bootstrap'))
const steady = summarize(results.filter(result => result.phase === 'steady'))
const elapsedSec = (finishedAt - startedAt) / 1000
const firstRequestOffsets = virtualUsers
  .map(user => user.firstRequestStartedAt == null ? null : user.firstRequestStartedAt - startedAt)
  .filter(value => value != null)
const startSkewMs = firstRequestOffsets.length ? Math.round(Math.max(...firstRequestOffsets)) : 0
const fiveXx = results.filter(result => result.errorType === 'http_5xx').length
const fourXx = results.filter(result => result.errorType === 'http_4xx').length
const timeouts = results.filter(result => result.errorType === 'timeout').length
const networkErrors = results.filter(result => result.errorType === 'network').length
const exactErrorRatePct = results.length ? (overall.failures / results.length) * 100 : 0
const underMinimum = virtualUsers.filter(user => user.requests < minRequestsPerUser)
const underSteadyMinimum = virtualUsers.filter(user => user.steadyRequests < minSteadyRequestsPerUser)

console.log('Overall result')
console.table([{
  ...overall,
  elapsedSec: Number(elapsedSec.toFixed(1)),
  requestsPerSec: Number((results.length / Math.max(elapsedSec, 0.001)).toFixed(2)),
  maxConcurrent: maxConcurrentRequests,
  startSkewMs,
  http4xx: fourXx,
  http5xx: fiveXx,
  timeouts,
  networkErrors
}])
console.log('Phase result')
console.table([
  { phase: 'bootstrap', ...bootstrap },
  { phase: 'steady', ...steady }
])
console.log('Per-profile result')
console.table(groupSummary(results, 'profile'))
console.log('Per-endpoint result')
console.table(groupSummary(results, 'endpoint'))

if (realtimeEnabled) {
  const subscribed = realtimeResults.filter(result => result.subscribed).length
  const subscribeTimeouts = realtimeResults.filter(result => result.subscribeTimedOut).length
  const channelErrors = realtimeResults.reduce((sum, result) => sum + result.channelErrors, 0)
  const events = realtimeResults.reduce((sum, result) => sum + result.events, 0)
  const subscriptionTimes = realtimeResults
    .map(result => result.subscribedMs)
    .filter(value => value != null)
    .sort((a, b) => a - b)
  console.log('Realtime result (subscriptions only)')
  console.table([{
    requested: realtimeUsers,
    subscribed,
    subscribeTimeouts,
    channelErrors,
    events,
    subscribeP50Ms: percentile(subscriptionTimes, 0.50),
    subscribeP95Ms: percentile(subscriptionTimes, 0.95),
    subscribeMaxMs: subscriptionTimes.at(-1) || 0
  }])
}

const failureReasons = []
if (interrupted) failureReasons.push('Test was interrupted.')
if (results.length === 0) failureReasons.push('No HTTP requests completed.')
if (exactErrorRatePct > maxErrorRatePct) {
  failureReasons.push(`Error rate ${exactErrorRatePct.toFixed(2)}% exceeds ${maxErrorRatePct}%.`)
}
if (fiveXx > max5xx) failureReasons.push(`HTTP 5xx count ${fiveXx} exceeds ${max5xx}.`)
if (timeouts > maxTimeouts) failureReasons.push(`Timeout count ${timeouts} exceeds ${maxTimeouts}.`)
if (overall.p95Ms > p95LimitMs) failureReasons.push(`p95 ${overall.p95Ms}ms exceeds ${p95LimitMs}ms.`)
if (overall.p99Ms > p99LimitMs) failureReasons.push(`p99 ${overall.p99Ms}ms exceeds ${p99LimitMs}ms.`)
if (maxConcurrentRequests < minConcurrency) {
  failureReasons.push(`Peak concurrency ${maxConcurrentRequests} is below ${minConcurrency}.`)
}
if (startSkewMs > startSkewLimitMs) failureReasons.push(`Start skew ${startSkewMs}ms exceeds ${startSkewLimitMs}ms.`)
if (underMinimum.length > 0) {
  failureReasons.push(`${underMinimum.length} users made fewer than ${minRequestsPerUser} requests.`)
}
if (underSteadyMinimum.length > 0) {
  failureReasons.push(`${underSteadyMinimum.length} users made fewer than ${minSteadyRequestsPerUser} steady-state requests.`)
}
if (!interrupted && elapsedSec < durationSec * 0.95) {
  failureReasons.push(`Observed duration ${elapsedSec.toFixed(1)}s is shorter than configured ${durationSec}s.`)
}
if (realtimeEnabled) {
  const unsubscribed = realtimeResults.filter(result => !result.subscribed).length
  const realtimeErrors = realtimeResults.reduce((sum, result) => sum + result.channelErrors, 0)
  if (realtimeResults.length !== realtimeUsers) {
    failureReasons.push(`Only ${realtimeResults.length}/${realtimeUsers} Realtime sessions reported.`)
  }
  if (unsubscribed > 0) failureReasons.push(`${unsubscribed} Realtime sessions did not subscribe.`)
  if (realtimeErrors > 0) failureReasons.push(`Realtime reported ${realtimeErrors} channel errors.`)
}

const failures = results.filter(result => result.error)
if (failures.length > 0) {
  console.log('First request failures')
  console.table(failures.slice(0, 20).map(result => ({
    userId: result.userId,
    profile: result.profile,
    phase: result.phase,
    endpoint: result.endpoint,
    status: result.status,
    error: result.error,
    durationMs: result.durationMs
  })))
}

if (underMinimum.length > 0 || underSteadyMinimum.length > 0) {
  console.log('Users below request minimums')
  console.table(virtualUsers
    .filter(user => user.requests < minRequestsPerUser || user.steadyRequests < minSteadyRequestsPerUser)
    .slice(0, 20)
    .map(user => ({
      userId: user.id,
      profile: user.profileName,
      requests: user.requests,
      steadyRequests: user.steadyRequests,
      failures: user.failures
    })))
}

if (failureReasons.length > 0) {
  console.error('FAIL')
  failureReasons.forEach(reason => console.error(`- ${reason}`))
  process.exitCode = 1
} else {
  console.log('PASS: sustained read-only load stayed within every configured threshold.')
}
