const WINDOW_MS = 60_000
const buckets = new Map()

export function setApiSecurityHeaders(res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'DENY')
}

export function enforceSameOrigin(req, res) {
  const origin = String(req.headers.origin || '').replace(/\/$/, '')
  if (!origin) return true

  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '')
  const expectedOrigin = host ? `https://${host}` : ''
  const configuredOrigins = String(process.env.APP_ORIGIN || '')
    .split(',')
    .map(value => value.trim().replace(/\/$/, ''))
    .filter(Boolean)
  const allowed = new Set([expectedOrigin, ...configuredOrigins].filter(Boolean))

  if (!allowed.has(origin)) {
    res.status(403).json({ success: false, errors: ['Cross-origin request rejected'] })
    return false
  }

  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Vary', 'Origin')
  return true
}

export function enforceRateLimit(req, res, { limit = 30, scope = 'api' } = {}) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  const key = `${scope}:${forwarded || req.socket?.remoteAddress || 'unknown'}`
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }

  current.count += 1
  if (current.count > limit) {
    res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
    res.status(429).json({ success: false, errors: ['Too many requests'] })
    return false
  }
  return true
}

const readBearerToken = (req) => {
  const header = String(req.headers.authorization || '')
  return header.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

// Supabase anon keys are public client identifiers, not credentials. These
// fallbacks keep serverless JWT verification operational when Vite build vars
// are unavailable at function runtime. The token is still verified by GoTrue.
const PUBLIC_PROJECTS = {
  hurzutjytlcvtbvihnry: {
    url: 'https://hurzutjytlcvtbvihnry.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
  },
  qpiysrkhvdgctaqmfsew: {
    url: 'https://qpiysrkhvdgctaqmfsew.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg4OTcxMzUsImV4cCI6MjEwNDQ3MzEzNX0.Jvx-saMNE97zyy8IaXk9dd7C1q-quoK-R0IopUsVXI8'
  }
}

const readUnverifiedProjectRef = token => {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    if (payload.ref) return String(payload.ref)
    return new URL(String(payload.iss || '')).hostname.split('.')[0]
  } catch { return '' }
}

const serverSupabaseConfig = token => {
  const configured = {
    url: String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
    anonKey: String(process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '')
  }
  if (configured.url && configured.anonKey) return configured
  return PUBLIC_PROJECTS[readUnverifiedProjectRef(token)] || { url: '', anonKey: '' }
}

export async function requireMesUser(req, res, requiredRights = []) {
  const token = readBearerToken(req)
  const { url, anonKey } = serverSupabaseConfig(token)
  if (!token || !url || !anonKey) {
    res.status(401).json({ success: false, errors: ['Authentication required'] })
    return null
  }

  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  }

  const authResponse = await fetch(`${url}/auth/v1/user`, { headers })
  if (!authResponse.ok) {
    res.status(401).json({ success: false, errors: ['Invalid or expired session'] })
    return null
  }

  const profileResponse = await fetch(`${url}/rest/v1/rpc/rpc_current_user_profile`, {
    method: 'POST',
    headers,
    body: '{}'
  })
  if (!profileResponse.ok) {
    res.status(403).json({ success: false, errors: ['MES profile is not linked to this session'] })
    return null
  }

  const profile = await profileResponse.json()
  const rights = profile?.access_rights || {}
  const hasRight = right => Array.isArray(rights) ? rights.includes(right) : rights[right] === true
  const authorized = requiredRights.length === 0 || requiredRights.some(hasRight)
  if (!authorized) {
    res.status(403).json({ success: false, errors: ['Insufficient permissions'] })
    return null
  }
  return profile
}

export function hasValidBodySize(req, res, maxBytes = 64 * 1024) {
  const size = Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8')
  if (size <= maxBytes) return true
  res.status(413).json({ success: false, errors: ['Request body is too large'] })
  return false
}
