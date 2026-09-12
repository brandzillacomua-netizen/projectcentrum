const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'AUDIT_EMAIL', 'AUDIT_PASSWORD']
const missing = required.filter(name => !process.env[name])

if (missing.length > 0) {
  console.error(`Missing atomic smoke environment variables: ${missing.join(', ')}`)
  process.exit(2)
}

const supabaseUrl = String(process.env.VITE_SUPABASE_URL).replace(/\/$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const expectedVersion = '2026-09-12.atomic_contract_v4'
const nonexistentCardId = crypto.randomUUID()

const anonHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  'Content-Type': 'application/json'
}

const payload = {
  p_card_id: nonexistentCardId,
  p_card_update: { status: 'new' },
  p_history_data: null,
  p_idempotency_key: `readonly_smoke_${nonexistentCardId}`,
  p_session_id: 'readonly_release_smoke'
}

const anonymousResponse = await fetch(
  `${supabaseUrl}/rest/v1/rpc/rpc_transition_work_card_atomic`,
  { method: 'POST', headers: anonHeaders, body: JSON.stringify(payload) }
)

if (![401, 403, 404].includes(anonymousResponse.status)) {
  throw new Error(`Anonymous atomic RPC must be denied, received HTTP ${anonymousResponse.status}`)
}
console.log(`PASS anonymous atomic RPC denied: HTTP ${anonymousResponse.status}`)

const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD })
})
const login = await loginResponse.json().catch(() => ({}))

if (!loginResponse.ok || !login.access_token) {
  throw new Error(`Atomic smoke login failed: HTTP ${loginResponse.status}`)
}

const authenticatedHeaders = {
  apikey: anonKey,
  Authorization: `Bearer ${login.access_token}`,
  'Content-Type': 'application/json'
}

try {
  const rpcResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/rpc_transition_work_card_atomic`,
    { method: 'POST', headers: authenticatedHeaders, body: JSON.stringify(payload) }
  )
  const result = await rpcResponse.json().catch(() => null)

  if (!rpcResponse.ok) {
    throw new Error(`Authenticated atomic RPC failed: HTTP ${rpcResponse.status}`)
  }
  if (result?.card_not_found !== true || result?.success !== false) {
    throw new Error('Atomic RPC touched or unexpectedly resolved a random nonexistent card')
  }
  if (result?.rpc_version !== expectedVersion) {
    throw new Error(`Atomic RPC version mismatch: expected ${expectedVersion}, received ${result?.rpc_version || 'none'}`)
  }

  console.log(`PASS authenticated atomic RPC contract: ${result.rpc_version}`)
  console.log('PASS no production row mutated: random card returned card_not_found')
} finally {
  await fetch(`${supabaseUrl}/auth/v1/logout`, {
    method: 'POST',
    headers: authenticatedHeaders
  }).catch(() => {})
}
