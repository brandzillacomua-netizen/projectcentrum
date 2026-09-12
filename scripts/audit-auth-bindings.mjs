const required = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'AUDIT_EMAIL', 'AUDIT_PASSWORD']
const missing = required.filter(name => !process.env[name])

if (missing.length) {
  console.error(`Missing auth-audit environment variables: ${missing.join(', ')}`)
  process.exit(2)
}

const supabaseUrl = String(process.env.VITE_SUPABASE_URL).replace(/\/$/, '')
const anonKey = process.env.VITE_SUPABASE_ANON_KEY
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const loginResponse = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anonKey, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD })
})
const loginPayload = await loginResponse.json().catch(() => ({}))
const accessToken = loginPayload.access_token

if (!loginResponse.ok || !accessToken) {
  console.error(`Auth binding audit could not sign in (HTTP ${loginResponse.status}).`)
  process.exit(1)
}

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${accessToken}`,
  Accept: 'application/json',
  Prefer: 'count=exact',
  Range: '0-9999'
}

try {
  const [directoryResponse, authUserResponse, profileResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/system_users?select=id,login,auth_user_id,access_rights&order=id.asc`, { headers }),
    fetch(`${supabaseUrl}/auth/v1/user`, { headers }),
    fetch(`${supabaseUrl}/rest/v1/rpc/rpc_current_user_profile`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: '{}'
    })
  ])

  const directory = await directoryResponse.json().catch(() => null)
  const authUser = await authUserResponse.json().catch(() => null)
  const profile = await profileResponse.json().catch(() => null)

  if (!directoryResponse.ok || !Array.isArray(directory)) {
    console.error(`Cannot read the authenticated MES user directory (HTTP ${directoryResponse.status}).`)
    process.exit(1)
  }
  if (!authUserResponse.ok || !authUser?.id) {
    console.error(`Cannot resolve the current Supabase Auth identity (HTTP ${authUserResponse.status}).`)
    process.exit(1)
  }
  if (!profileResponse.ok || !profile?.id) {
    console.error(`Current Auth account is not linked to a MES profile (HTTP ${profileResponse.status}).`)
    process.exit(1)
  }

  const unlinked = directory.filter(user => !user.auth_user_id)
  const malformedBindings = directory.filter(user => user.auth_user_id && !uuidPattern.test(user.auth_user_id))
  const invalidRights = directory.filter(user => {
    const rights = user.access_rights
    return rights != null && (typeof rights !== 'object' || Array.isArray(rights))
  })
  const bindings = directory.map(user => user.auth_user_id).filter(Boolean)
  const duplicateBindings = bindings.filter((value, index) => bindings.indexOf(value) !== index)
  const logins = directory.map(user => String(user.login || '').trim().toLowerCase()).filter(Boolean)
  const duplicateLogins = logins.filter((value, index) => logins.indexOf(value) !== index)
  const currentProfile = directory.find(user => String(user.id) === String(profile.id))
  const currentBindingValid = currentProfile?.auth_user_id === authUser.id

  const report = {
    users: directory.length,
    linked: bindings.length,
    unlinked: unlinked.length,
    malformedBindings: malformedBindings.length,
    duplicateBindings: new Set(duplicateBindings).size,
    duplicateLogins: new Set(duplicateLogins).size,
    invalidAccessRights: invalidRights.length,
    currentIdentityBindingValid: currentBindingValid
  }

  const failures = [
    report.unlinked,
    report.malformedBindings,
    report.duplicateBindings,
    report.duplicateLogins,
    report.invalidAccessRights,
    currentBindingValid ? 0 : 1
  ].reduce((sum, value) => sum + value, 0)

  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2))
  else {
    console.log('Authenticated identity binding audit:')
    console.table(report)
  }

  if (failures > 0) {
    console.error('Auth binding audit failed. Run the read-only SQL preflight for exact affected records.')
    process.exitCode = 1
  } else {
    console.log('Auth binding audit passed. Full auth.users existence still requires the read-only SQL preflight.')
  }
} finally {
  await fetch(`${supabaseUrl}/auth/v1/logout`, { method: 'POST', headers }).catch(() => {})
}
