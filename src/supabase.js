import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
export const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const SUPABASE_READ_CONCURRENCY = 6
const SUPABASE_READ_TIMEOUT_MS = 30 * 1000
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
let activeSupabaseReads = 0
const pendingSupabaseReads = []

const acquireSupabaseReadSlot = () => new Promise(resolve => {
  const start = () => {
    activeSupabaseReads += 1
    let released = false
    resolve(() => {
      if (released) return
      released = true
      activeSupabaseReads = Math.max(0, activeSupabaseReads - 1)
      const next = pendingSupabaseReads.shift()
      if (next) next()
    })
  }

  if (activeSupabaseReads < SUPABASE_READ_CONCURRENCY) start()
  else pendingSupabaseReads.push(start)
})

const trackedSupabaseFetch = async (...args) => {
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
  let releaseReadSlot = () => {}
  let readTimeout = null
  let detachCallerAbort = null
  let fetchArgs = args
  let readAbortController = null

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
  }

  // The deadline includes time spent waiting in the per-tab queue. If the
  // database is unavailable, every queued bootstrap read expires together
  // instead of blocking the tab for N × 20 seconds.
  if (isReadRequest) releaseReadSlot = await acquireSupabaseReadSlot()

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
  window.__mesApiHealth = health

  try {
    const response = await fetch(...fetchArgs)
    const durationMs = Math.round(performance.now() - startedAt)
    if (durationMs >= 3000) health.slow += 1
    if (!response.ok) {
      health.failed += 1
      health.lastErrorAt = Date.now()
    }
    return response
  } catch (error) {
    health.failed += 1
    health.lastErrorAt = Date.now()
    throw error
  } finally {
    if (readTimeout) clearTimeout(readTimeout)
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

export const rawSupabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: false
  },
  global: {
    fetch: trackedSupabaseFetch
  },
  realtime: {
    // Keep heartbeat timers alive when a terminal/browser tab is backgrounded.
    // Without the worker browsers may throttle timers and leave the UI looking
    // connected while the websocket has already gone stale.
    worker: true,
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
})

// Sync time drift and patch Date globally to use synchronized time
const OriginalDate = window.Date;

// Global time drift tracking
window.timeDrift = window.timeDrift || 0;

const PatchedDate = function(...args) {
  if (!(this instanceof PatchedDate)) {
    return new OriginalDate(OriginalDate.now() + (window.timeDrift || 0)).toString();
  }
  if (args.length === 0) {
    return new OriginalDate(OriginalDate.now() + (window.timeDrift || 0));
  }
  return new OriginalDate(...args);
};

PatchedDate.prototype = OriginalDate.prototype;
PatchedDate.now = function () {
  return OriginalDate.now() + (window.timeDrift || 0);
};

if (OriginalDate.parse) PatchedDate.parse = OriginalDate.parse;
if (OriginalDate.UTC) PatchedDate.UTC = OriginalDate.UTC;

window.Date = PatchedDate;

export function getCurrentTime() {
  return new PatchedDate();
}
window.getCurrentTime = getCurrentTime;

// Sync time immediately on load and every 5 minutes
async function syncTimeDrift() {
  // 1. Try same-origin first (highly reliable in browser, bypasses cross-origin CORS limitations)
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

  // 2. Fallback: Try UTC-based time APIs (parse strictly as UTC to avoid local timezone offset shifts)
  const apis = [
    {
      url: 'https://worldtimeapi.org/api/timezone/Etc/UTC',
      parse: (json) => json.unixtime * 1000
    },
    {
      url: 'https://timeapi.io/api/Time/current/zone?timeZone=UTC',
      parse: (json) => new OriginalDate(json.dateTime + 'Z').getTime()
    }
  ];

  for (const api of apis) {
    try {
      const start = OriginalDate.now();
      const response = await fetch(api.url);
      if (!response.ok) continue;
      const json = await response.json();
      const serverTimeMs = api.parse(json);
      if (serverTimeMs) {
        const latency = (OriginalDate.now() - start) / 2;
        window.timeDrift = (serverTimeMs + latency) - OriginalDate.now();
        console.log('[Time Sync] Server drift synchronized via UTC API:', window.timeDrift, 'ms');
        return;
      }
    } catch (e) {
      console.warn('[Time Sync] API sync failed:', api.url, e);
    }
  }

  // 3. Fallback: Try Supabase date header (last resort)
  try {
    const start = OriginalDate.now();
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey
      }
    });
    const serverDate = response.headers.get('date');
    if (serverDate) {
      const serverTimeMs = new OriginalDate(serverDate).getTime();
      const latency = (OriginalDate.now() - start) / 2;
      window.timeDrift = (serverTimeMs + latency) - OriginalDate.now();
      console.log('[Time Sync] Server drift synchronized via Supabase header:', window.timeDrift, 'ms');
    }
  } catch (e) {
    console.warn('[Time Sync] Failed to sync time drift:', e);
  }
}

syncTimeDrift();
setInterval(syncTimeDrift, 5 * 60 * 1000);

// Global set to keep track of record IDs created/updated by this client session
window.myConfirmedWrites = window.myConfirmedWrites || new Set()

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

export const supabase = new Proxy(rawSupabase, {
  get(target, prop, receiver) {
    if (prop === 'from') {
      return function (tableName) {
        const builder = target.from(tableName)
        return wrapQueryBuilder(builder, tableName)
      }
    }
    if (prop === 'channel') {
      return function (topic, options) {
        return wrapRealtimeChannel(target.channel(topic, options), topic)
      }
    }
    return Reflect.get(target, prop, receiver)
  }
})
