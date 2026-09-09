import { createClient } from '@supabase/supabase-js'

// ── Multi-environment routing (Production vs Staging testbdkulytcya) ──────────
const STAGING_URL = 'https://qpiysrkhvdgctaqmfsew.supabase.co'
const STAGING_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTcxMzUsImV4cCI6MjEwNDQ3MzEzNX0.Jvx-saMNE97zyy8IaXk9dd7C1q-quoK-R0IopUsVXI8'

export const isTestEnvironment = () => {
  if (typeof window === 'undefined' || !window.location) return false
  try {
    const search = window.location.search || ''
    const pathname = window.location.pathname || ''
    
    // Explicit return to PROD
    if (search.includes('env=prod')) {
      window.localStorage?.removeItem('centrum_env')
      return false
    }
    // Explicit entry to TEST via /test or query
    if (pathname === '/test' || pathname.startsWith('/test/') || search.includes('env=test')) {
      window.localStorage?.setItem('centrum_env', 'test')
      return true
    }
    // Maintain test mode if set
    return window.localStorage?.getItem('centrum_env') === 'test'
  } catch (e) {
    return false
  }
}

const RAW_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://hurzutjytlcvtbvihnry.supabase.co'
export const PROD_URL = RAW_SUPABASE_URL.includes('brandzilla-com-ua.workers.dev')
  ? 'https://hurzutjytlcvtbvihnry.supabase.co'
  : RAW_SUPABASE_URL
export const PROD_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

export const isStaging = isTestEnvironment()
export const supabaseUrl = isStaging ? STAGING_URL : PROD_URL
export const supabaseAnonKey = isStaging ? STAGING_ANON_KEY : PROD_ANON_KEY

const SUPABASE_OPERATIONAL_CONCURRENCY = 6
const SUPABASE_ANALYTICAL_CONCURRENCY = 2
const SUPABASE_READ_TIMEOUT_MS = 30 * 1000
const SUPABASE_WRITE_TIMEOUT_MS = 15 * 1000
const SUPABASE_READ_ONLY_RPCS = new Set([
  'chat_unread_counts',
  'mes_fulfillment_queue',
  'mes_production_summary',
  'mes_monthly_report',
  'mes_monthly_naryad_detail',
  'shop1_naryad_catalog',
  'shop1_naryad_report',
  'verify_user_password'
])
const SUPABASE_HEAVY_ANALYTICAL_RPCS = new Set([
  'mes_monthly_report',
  'mes_monthly_naryad_detail',
  'shop1_naryad_report'
])

let activeOperationalReads = 0
const pendingOperationalReads = []

let activeAnalyticalReads = 0
const pendingAnalyticalReads = []

const acquireSupabaseReadSlot = (isAnalytical = false) => new Promise(resolve => {
  if (isAnalytical) {
    const start = () => {
      activeAnalyticalReads += 1
      let released = false
      resolve(() => {
        if (released) return
        released = true
        activeAnalyticalReads = Math.max(0, activeAnalyticalReads - 1)
        const next = pendingAnalyticalReads.shift()
        if (next) next()
      })
    }

    if (activeAnalyticalReads < SUPABASE_ANALYTICAL_CONCURRENCY) start()
    else pendingAnalyticalReads.push(start)
  } else {
    const start = () => {
      activeOperationalReads += 1
      let released = false
      resolve(() => {
        if (released) return
        released = true
        activeOperationalReads = Math.max(0, activeOperationalReads - 1)
        const next = pendingOperationalReads.shift()
        if (next) next()
      })
    }

    if (activeOperationalReads < SUPABASE_OPERATIONAL_CONCURRENCY) start()
    else pendingOperationalReads.push(start)
  }
})

export function getJwtProjectRef(jwt) {
  try {
    if (!jwt || typeof jwt !== 'string') return null
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payloadJson = typeof window !== 'undefined' && window.atob
      ? window.atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
      : (typeof Buffer !== 'undefined' ? Buffer.from(parts[1], 'base64').toString('utf8') : null)
    if (!payloadJson) return null
    const payload = JSON.parse(payloadJson)
    if (payload.ref) return payload.ref
    if (payload.iss) {
      const match = payload.iss.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)
      if (match) return match[1]
    }
    return null
  } catch {
    return null
  }
}

const trackedSupabaseFetch = async (...args) => {
  // Normalize URL to direct Supabase origin if it points to the blocked Cloudflare worker
  if (typeof args[0] === 'string' && args[0].includes('brandzilla-com-ua.workers.dev')) {
    args[0] = args[0].replace('https://centrum-gateway.brandzilla-com-ua.workers.dev', 'https://hurzutjytlcvtbvihnry.supabase.co')
  } else if (args[0] && typeof args[0].url === 'string' && args[0].url.includes('brandzilla-com-ua.workers.dev')) {
    args[0] = new Request(args[0].url.replace('https://centrum-gateway.brandzilla-com-ua.workers.dev', 'https://hurzutjytlcvtbvihnry.supabase.co'), args[0])
  }

  const requestMethod = String(args[1]?.method || args[0]?.method || 'GET').toUpperCase()
  let rpcName = null
  try {
    const requestUrl = new URL(
      typeof args[0] === 'string' ? args[0] : args[0]?.url,
      window.location.origin
    )
    const rpcMarker = '/rest/v1/rpc/'
    const rpcMarkerIndex = requestUrl.pathname.indexOf(rpcMarker)
    if (rpcMarkerIndex >= 0) {
      rpcName = decodeURIComponent(requestUrl.pathname.slice(rpcMarkerIndex + rpcMarker.length)).split('/')[0]
    }
  } catch {
    // Unknown URLs keep the conservative method-only classification below.
  }
  const isReadRequest = ['GET', 'HEAD'].includes(requestMethod)
    || (requestMethod === 'POST' && SUPABASE_READ_ONLY_RPCS.has(rpcName))
  const isAnalyticalRequest = Boolean(rpcName && SUPABASE_HEAVY_ANALYTICAL_RPCS.has(rpcName))
  let releaseReadSlot = () => {}
  let readTimeout = null
  let writeTimeout = null
  let detachCallerAbort = null
  let fetchArgs = args
  let readAbortController = null
  let writeAbortController = null

  if (isReadRequest) {
    readAbortController = new AbortController()
    const callerAbortSignal = args[1]?.signal || args[0]?.signal || null

    const abortFromCaller = () => {
      if (!readAbortController.signal.aborted) {
        readAbortController.abort(callerAbortSignal?.reason)
      }
    }

    if (callerAbortSignal?.aborted) {
      abortFromCaller()
    } else if (callerAbortSignal) {
      callerAbortSignal.addEventListener('abort', abortFromCaller, { once: true })
      detachCallerAbort = () => callerAbortSignal.removeEventListener('abort', abortFromCaller)
    }

    readTimeout = setTimeout(() => {
      if (!readAbortController.signal.aborted) {
        readAbortController.abort(new DOMException(
          `Supabase read timed out after ${SUPABASE_READ_TIMEOUT_MS}ms`,
          'TimeoutError'
        ))
      }
    }, SUPABASE_READ_TIMEOUT_MS)

    fetchArgs = [args[0], {
      ...(args[1] || {}),
      signal: readAbortController.signal
    }]
  } else {
    // Write requests (mutations) have a safe 15s timeout to prevent infinite hangs during network dropouts
    writeAbortController = new AbortController()
    const callerAbortSignal = args[1]?.signal || args[0]?.signal || null

    const abortFromCaller = () => {
      if (!writeAbortController.signal.aborted) {
        writeAbortController.abort(callerAbortSignal?.reason)
      }
    }

    if (callerAbortSignal?.aborted) {
      abortFromCaller()
    } else if (callerAbortSignal) {
      callerAbortSignal.addEventListener('abort', abortFromCaller, { once: true })
      detachCallerAbort = () => callerAbortSignal.removeEventListener('abort', abortFromCaller)
    }

    writeTimeout = setTimeout(() => {
      if (!writeAbortController.signal.aborted) {
        writeAbortController.abort(new DOMException(
          `Supabase write timed out after ${SUPABASE_WRITE_TIMEOUT_MS}ms`,
          'TimeoutError'
        ))
      }
    }, SUPABASE_WRITE_TIMEOUT_MS)

    fetchArgs = [args[0], {
      ...(args[1] || {}),
      signal: writeAbortController.signal
    }]
  }

  // The deadline includes time spent waiting in the per-tab queue. If the
  // database is unavailable, every queued bootstrap read expires together
  // instead of blocking the tab for N × 20 seconds.
  if (isReadRequest) releaseReadSlot = await acquireSupabaseReadSlot(isAnalyticalRequest)

  const startedAt = performance.now()
  const health = window.__mesApiHealth || {
    active: 0,
    maxActive: 0,
    total: 0,
    failed: 0,
    slow: 0,
    lastErrorAt: null
  }

  health.active += 1
  health.total += 1
  health.maxActive = Math.max(health.maxActive, health.active)

  // Enterprise JWT Attachment: Ensure Bearer token is attached if available and matches the active project
  // Never attach custom token to verify_user_password or auth endpoints (they must use the valid anonKey)
  const isTest = isTestEnvironment()
  const expectedRef = isTest ? 'qpiysrkhvdgctaqmfsew' : 'hurzutjytlcvtbvihnry'
  const tokenKey = isTest ? 'BACKEND_TOKEN_STAGING' : 'BACKEND_TOKEN'
  const anonKey = isTest ? STAGING_ANON_KEY : PROD_ANON_KEY
  const isAuthEndpoint = rpcName === 'verify_user_password' || (typeof args[0] === 'string' && args[0].includes('/auth/v1/'))

  if (typeof window !== 'undefined' && !isAuthEndpoint) {
    let token = localStorage.getItem(tokenKey)
    if (token) {
      const tokenRef = getJwtProjectRef(token)
      if (!tokenRef || tokenRef !== expectedRef) {
        localStorage.removeItem(tokenKey)
        token = null
      }
    }

    const existingHeaders = fetchArgs[1]?.headers || (fetchArgs[0] instanceof Request ? fetchArgs[0].headers : null)
    const headers = new Headers(existingHeaders || {})
    
    // Validate any existing Authorization header
    const currentAuth = headers.get('Authorization')
    if (currentAuth && currentAuth.startsWith('Bearer ')) {
      const currentJwt = currentAuth.slice(7).trim()
      const currentRef = getJwtProjectRef(currentJwt)
      if (currentRef && currentRef !== expectedRef) {
        headers.set('Authorization', `Bearer ${anonKey}`)
        headers.set('apikey', anonKey)
        localStorage.removeItem(`sb-${expectedRef}-auth-token`)
      }
    } else if (token) {
      headers.set('Authorization', `Bearer ${token}`)
      headers.set('apikey', anonKey)
    } else {
      headers.set('Authorization', `Bearer ${anonKey}`)
      headers.set('apikey', anonKey)
    }

    fetchArgs = [
      fetchArgs[0],
      {
        ...(fetchArgs[1] || {}),
        headers
      }
    ]
  }

  try {
    const response = await fetch(...fetchArgs)
    const durationMs = Math.round(performance.now() - startedAt)
    if (durationMs >= 3000) health.slow += 1
    if (!response.ok) {
      health.failed += 1
      health.lastErrorAt = Date.now()
      if (response.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem(tokenKey)
        localStorage.removeItem(`sb-${expectedRef}-auth-token`)
      }
    }
    return response
  } catch (error) {
    health.failed += 1
    health.lastErrorAt = Date.now()
    throw error
  } finally {
    if (readTimeout) clearTimeout(readTimeout)
    if (writeTimeout) clearTimeout(writeTimeout)
    if (detachCallerAbort) detachCallerAbort()
    health.active = Math.max(0, health.active - 1)
    releaseReadSlot()
    window.dispatchEvent(new CustomEvent('mes:api-health', {
      detail: { ...health }
    }))
  }
}

const realtimeChannelStates = new Map()

const publishRealtimeChannelHealth = (topic, status, error) => {
  if (typeof window === 'undefined') return

  if (status === 'CLOSED') {
    realtimeChannelStates.delete(topic)
  } else {
    realtimeChannelStates.set(topic, status)
  }

  const unhealthy = Array.from(realtimeChannelStates.values())
    .some(value => value === 'CHANNEL_ERROR' || value === 'TIMED_OUT')
  const detail = {
    topic,
    status,
    unhealthy,
    error: error?.message || null,
    at: Date.now()
  }

  window.__mesRealtimeChannels = Object.fromEntries(realtimeChannelStates)
  window.dispatchEvent(new CustomEvent('mes:realtime-channel', { detail }))
}

const wrapRealtimeChannel = (channel, topic) => {
  if (!channel || channel.__mesHealthWrapped) return channel

  const originalSubscribe = channel.subscribe.bind(channel)
  channel.subscribe = (callback, timeout) => originalSubscribe((status, error) => {
    publishRealtimeChannelHealth(topic, status, error)
    if (callback) callback(status, error)
  }, timeout)
  channel.__mesHealthWrapped = true
  return channel
}

const clientOptions = {
  auth: {
    lock: false,
    autoRefreshToken: true,
    persistSession: true
  },
  global: {
    fetch: trackedSupabaseFetch
  },
  realtime: {
    worker: typeof window !== 'undefined' && typeof window.Worker !== 'undefined',
    heartbeatCallback: (status, latency) => {
      if (typeof window === 'undefined') return

      const detail = {
        status,
        latency: Number.isFinite(latency) ? latency : null,
        at: Date.now()
      }

      window.__mesRealtimeHealth = detail
      window.dispatchEvent(new CustomEvent('mes:realtime-health', { detail }))
    }
  }
}

export const prodClient = createClient(PROD_URL, PROD_ANON_KEY, {
  ...clientOptions,
  auth: {
    ...clientOptions.auth,
    storageKey: 'sb-hurzutjytlcvtbvihnry-auth-token'
  }
})

export const stagingClient = createClient(STAGING_URL, STAGING_ANON_KEY, {
  ...clientOptions,
  auth: {
    ...clientOptions.auth,
    storageKey: 'sb-qpiysrkhvdgctaqmfsew-auth-token'
  }
})

export const getActiveSupabase = () => isTestEnvironment() ? stagingClient : prodClient

export const rawSupabase = new Proxy(prodClient, {
  get(target, prop, receiver) {
    if (Object.prototype.hasOwnProperty.call(target, prop)) {
      return Reflect.get(target, prop, receiver)
    }
    const active = getActiveSupabase()
    const val = Reflect.get(active, prop, active)
    return typeof val === 'function' ? val.bind(active) : val
  },
  set(target, prop, value, receiver) {
    return Reflect.set(target, prop, value, receiver)
  }
})
 
if (typeof window !== 'undefined') {
  const syncAuth = (event, session) => {
    const isTest = isTestEnvironment()
    const tokenKey = isTest ? 'BACKEND_TOKEN_STAGING' : 'BACKEND_TOKEN'
    const userKey = isTest ? 'MES_SESSION_USER_STAGING' : 'MES_SESSION_USER'
    const loginKey = isTest ? 'MES_SESSION_LOGIN_STAGING' : 'MES_SESSION_LOGIN'
    const strictKey = isTest ? 'MES_SESSION_STRICT_STAGING' : 'MES_SESSION_STRICT'
    if (session?.access_token) {
      localStorage.setItem(tokenKey, session.access_token)
      localStorage.setItem(strictKey, 'true')
    } else if (event === 'SIGNED_OUT') {
      localStorage.removeItem(tokenKey)
      localStorage.removeItem(userKey)
      localStorage.removeItem(loginKey)
      localStorage.removeItem(strictKey)
    }
  }
  prodClient.auth.onAuthStateChange(syncAuth)
  stagingClient.auth.onAuthStateChange(syncAuth)
}

// Sync time drift and patch Date globally to use synchronized time
const OriginalDate = typeof window !== 'undefined' ? window.Date : (typeof globalThis !== 'undefined' ? globalThis.Date : Date);

if (typeof window !== 'undefined') {
  window.timeDrift = window.timeDrift || 0;
}

const PatchedDate = function(...args) {
  const drift = (typeof window !== 'undefined' && window.timeDrift) || 0;
  if (!(this instanceof PatchedDate)) {
    return new OriginalDate(OriginalDate.now() + drift).toString();
  }
  if (args.length === 0) {
    return new OriginalDate(OriginalDate.now() + drift);
  }
  return new OriginalDate(...args);
};

PatchedDate.prototype = OriginalDate.prototype;
PatchedDate.now = function () {
  const drift = (typeof window !== 'undefined' && window.timeDrift) || 0;
  return OriginalDate.now() + drift;
};

if (OriginalDate.parse) PatchedDate.parse = OriginalDate.parse;
if (OriginalDate.UTC) PatchedDate.UTC = OriginalDate.UTC;

if (typeof window !== 'undefined') {
  window.Date = PatchedDate;
}

export function getCurrentTime() {
  return new PatchedDate();
}
if (typeof window !== 'undefined') {
  window.getCurrentTime = getCurrentTime;
}

// Sync time immediately on load and every 5 minutes
async function syncTimeDrift() {
  // 1. Primary: Supabase REST date header (authoritative backend server time, zero 3rd-party latency)
  try {
    const start = OriginalDate.now();
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    const serverDate = response.headers.get('date');
    if (serverDate) {
      const serverTimeMs = new OriginalDate(serverDate).getTime();
      const latency = (OriginalDate.now() - start) / 2;
      window.timeDrift = (serverTimeMs + latency) - OriginalDate.now();
      console.log('[Time Sync] Server drift synchronized via Supabase header:', window.timeDrift, 'ms');
      return;
    }
  } catch (e) {
    console.warn('[Time Sync] Supabase server time sync warning:', e?.message || e);
  }

  // 2. Fallback: Try same-origin header in production browser
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    try {
      const start = OriginalDate.now();
      const response = await fetch(window.location.origin + '/?t=' + OriginalDate.now(), {
        method: 'HEAD',
        cache: 'no-store'
      });
      const serverDate = response.headers.get('date');
      if (serverDate) {
        const serverTimeMs = new OriginalDate(serverDate).getTime();
        const latency = (OriginalDate.now() - start) / 2;
        window.timeDrift = (serverTimeMs + latency) - OriginalDate.now();
        console.log('[Time Sync] Server drift synchronized via same-origin header:', window.timeDrift, 'ms');
        return;
      }
    } catch (e) {
      console.warn('[Time Sync] Same-origin sync failed:', e);
    }
  }
}

syncTimeDrift();
setInterval(syncTimeDrift, 5 * 60 * 1000);

// Global set to keep track of record IDs created/updated by this client session
if (typeof window !== 'undefined') {
  window.myConfirmedWrites = window.myConfirmedWrites || new Set()
}

function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Checks if a given incoming realtime change belongs to a database write
 * performed by this browser tab.
 */
export function isLocalWrite(tableName, newRecord) {
  if (!newRecord || !newRecord.id) return false
  return window.myConfirmedWrites.has(newRecord.id)
}

// Wrap PostgrestFilterBuilder to capture IDs used in filters like .eq('id', ...)
function wrapFilterBuilder(builder, tableName) {
  if (!builder) return builder
  
  return new Proxy(builder, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver)
      
      if (typeof originalValue === 'function') {
        return function (...args) {
          // 1. Intercept .eq('id', rowId)
          if (prop === 'eq' && args[0] === 'id' && args[1]) {
            window.myConfirmedWrites.add(args[1])
            const idToClean = args[1]
            setTimeout(() => { window.myConfirmedWrites.delete(idToClean) }, 5 * 60 * 1000)
          }
          // 2. Intercept .in('id', [rowId1, rowId2, ...])
          if (prop === 'in' && args[0] === 'id' && Array.isArray(args[1])) {
            args[1].forEach(id => {
              if (id) {
                window.myConfirmedWrites.add(id)
                setTimeout(() => { window.myConfirmedWrites.delete(id) }, 5 * 60 * 1000)
              }
            })
          }
          // 3. Intercept .match({ id: rowId })
          if (prop === 'match' && args[0] && typeof args[0] === 'object' && args[0].id) {
            const rowId = args[0].id
            window.myConfirmedWrites.add(rowId)
            const idToClean = rowId
            setTimeout(() => { window.myConfirmedWrites.delete(idToClean) }, 5 * 60 * 1000)
          }
          
          const result = originalValue.apply(target, args)
          return wrapFilterBuilder(result, tableName)
        }
      }
      return originalValue
    }
  })
}

// Wrap PostgrestQueryBuilder methods
function wrapQueryBuilder(builder, tableName) {
  const originalInsert = builder.insert
  const originalUpdate = builder.update
  const originalUpsert = builder.upsert

  builder.insert = function (values, options) {
    const isArray = Array.isArray(values)
    const cloned = isArray ? values.map(v => ({ ...v })) : (values ? { ...values } : {})
    const records = isArray ? cloned : [cloned]
    
    // Лише для таблиць з текстовими/UUID ідентифікаторами генеруємо UUID (work_cards, tasks тощо).
    // Для system_users, company_structure, company_positions ідентифікатори числові (bigint)
    const numericIdTables = ['system_users', 'company_structure', 'company_positions', 'machines', 'material_requests']
    const isNumericTable = numericIdTables.includes(tableName)

    for (const r of records) {
      if (r && typeof r === 'object') {
        if (!r.id && !isNumericTable) {
          r.id = generateUUID()
        }
        if (r.id) {
          window.myConfirmedWrites.add(r.id)
          const idToClean = r.id
          setTimeout(() => {
            window.myConfirmedWrites.delete(idToClean)
          }, 5 * 60 * 1000)
        }
      }
    }
    
    const filterBuilder = originalInsert.call(this, cloned, options)
    return wrapFilterBuilder(filterBuilder, tableName)
  }

  builder.update = function (values, options) {
    const filterBuilder = originalUpdate.call(this, values, options)
    return wrapFilterBuilder(filterBuilder, tableName)
  }

  builder.upsert = function (values, options) {
    const isArray = Array.isArray(values)
    const records = isArray ? values : [values]
    
    for (const r of records) {
      if (r && typeof r === 'object' && r.id) {
        window.myConfirmedWrites.add(r.id)
        const idToClean = r.id
        setTimeout(() => {
          window.myConfirmedWrites.delete(idToClean)
        }, 5 * 60 * 1000)
      }
    }
    
    const filterBuilder = originalUpsert.call(this, values, options)
    return wrapFilterBuilder(filterBuilder, tableName)
  }

  return builder
}

export const supabase = new Proxy(prodClient, {
  get(target, prop, receiver) {
    if (Object.prototype.hasOwnProperty.call(target, prop)) {
      const spied = Reflect.get(target, prop, receiver)
      if (typeof spied === 'function') return spied
    }
    const active = getActiveSupabase()
    if (prop === 'from') {
      return function (tableName) {
        const builder = active.from(tableName)
        return wrapQueryBuilder(builder, tableName)
      }
    }
    if (prop === 'channel') {
      return function (topic, options) {
        return wrapRealtimeChannel(active.channel(topic, options), topic)
      }
    }
    const val = Reflect.get(active, prop, active)
    return typeof val === 'function' ? val.bind(active) : val
  },
  set(target, prop, value, receiver) {
    return Reflect.set(target, prop, value, receiver)
  }
})

if (typeof window !== 'undefined') {
  window.supabase = supabase
}

