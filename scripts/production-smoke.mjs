const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'AUDIT_EMAIL', 'AUDIT_PASSWORD']
const missing = required.filter(name => !process.env[name])
if (missing.length) {
  console.error(`Missing smoke-test environment variables: ${missing.join(', ')}`)
  process.exit(2)
}

const appUrl = String(process.env.SMOKE_APP_URL || 'https://projectcentrum88.vercel.app').replace(/\/$/, '')
const supabaseUrl = String(process.env.VITE_SUPABASE_URL).replace(/\/$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const jsonHeaders = { apikey: anonKey, Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' }
const checks = []
const record = (name, ok, detail) => {
  checks.push({ name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${detail}`)
}

const expectStatus = async (name, url, init, accepted) => {
  try {
    const response = await fetch(url, init)
    record(name, accepted.includes(response.status), `HTTP ${response.status}`)
  } catch (error) {
    record(name, false, error?.message || 'network error')
  }
}

await expectStatus('application health', appUrl, { method: 'HEAD' }, [200])
await expectStatus('Nova Poshta anonymous deny', `${appUrl}/api/nova-poshta`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
}, [401])
await expectStatus('Telegram anonymous deny', `${appUrl}/api/telegram-alert`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
}, [401])
await expectStatus('legacy password RPC deny', `${supabaseUrl}/rest/v1/rpc/verify_user_password`, {
  method: 'POST', headers: jsonHeaders, body: JSON.stringify({ login_name: '__smoke__', plain_password: '__invalid__' })
}, [401, 403, 404])
await expectStatus('auth sync RPC deny', `${supabaseUrl}/rest/v1/rpc/sync_system_user_to_auth`, {
  method: 'POST', headers: jsonHeaders, body: JSON.stringify({ p_login: `__smoke_${crypto.randomUUID()}__` })
}, [401, 403, 404])

let accessToken = ''
try {
  const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD })
  })
  const login = await loginResponse.json()
  accessToken = login.access_token || ''
  record('audit login', loginResponse.ok && Boolean(accessToken), `HTTP ${loginResponse.status}`)

  if (accessToken) {
    const authHeaders = { apikey: anonKey, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
    const profileResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/rpc_current_user_profile`, {
      method: 'POST', headers: authHeaders, body: '{}'
    })
    const profile = await profileResponse.json().catch(() => null)
    record('audit profile link', profileResponse.ok && Boolean(profile?.id), `HTTP ${profileResponse.status}`)

    for (const table of ['system_configs', 'scrap_reasons', 'vkya_restoration_stages']) {
      const catalogResponse = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
        headers: authHeaders
      })
      record(`authenticated catalog read: ${table}`, catalogResponse.ok, `HTTP ${catalogResponse.status}`)
    }

    await fetch(`${supabaseUrl}/auth/v1/logout`, { method: 'POST', headers: authHeaders })
  }
} catch (error) {
  record('audit session', false, error?.message || 'network error')
}

if (checks.some(check => !check.ok)) process.exit(1)
console.log(`Production smoke passed (${checks.length} checks).`)
