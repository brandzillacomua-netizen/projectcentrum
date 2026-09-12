const REDACTED = '[REDACTED]'
const MAX_DEPTH = 8
const MAX_ARRAY_ITEMS = 50
const MAX_OBJECT_KEYS = 100
const MAX_STRING_LENGTH = 8000

const SENSITIVE_KEY = /(^|_)(authorization|cookie|password|passwd|pwd|secret|token|api_?key|access_?key|refresh_?token|session_?id|credential|email|phone|username)($|_)/i

const normalizeKey = (key) => String(key)
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/[.\s-]+/g, '_')

export const sanitizeTelemetryString = (value) => String(value)
  .slice(0, MAX_STRING_LENGTH)
  .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/gi, `Bearer ${REDACTED}`)
  .replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, REDACTED)
  .replace(/([?&](?:access_token|refresh_token|token|api_key|apikey|password|secret)=)[^&#\s]*/gi, `$1${REDACTED}`)
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
  .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/gi, `$1${REDACTED}@`)

export function sanitizeTelemetry(value, depth = 0, seen = new WeakSet()) {
  if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') return sanitizeTelemetryString(value)
  if (typeof value === 'bigint') return String(value)
  if (typeof value !== 'object') return sanitizeTelemetryString(value)
  if (depth >= MAX_DEPTH) return '[TRUNCATED]'
  if (seen.has(value)) return '[CIRCULAR]'

  seen.add(value)
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ARRAY_ITEMS).map(item => sanitizeTelemetry(item, depth + 1, seen))
  }

  const clean = {}
  for (const [key, item] of Object.entries(value).slice(0, MAX_OBJECT_KEYS)) {
    clean[key] = SENSITIVE_KEY.test(normalizeKey(key))
      ? REDACTED
      : sanitizeTelemetry(item, depth + 1, seen)
  }
  return clean
}

export function telemetrySafeUrl(locationLike) {
  try {
    const url = new URL(String(locationLike))
    return `${url.origin}${url.pathname}`
  } catch {
    return sanitizeTelemetryString(locationLike || '')
  }
}
