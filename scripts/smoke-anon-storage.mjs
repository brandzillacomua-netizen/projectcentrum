import { pathToFileURL } from 'node:url'

export function classifyAnonymousStorageList(status, payload) {
  if ([400, 401, 403].includes(status)) return { ok: true, detail: `HTTP ${status}` }
  if (status === 200 && Array.isArray(payload) && payload.length === 0) {
    return { ok: true, detail: 'HTTP 200 with zero RLS-visible objects' }
  }
  if (status === 200 && Array.isArray(payload)) {
    return { ok: false, detail: `anonymous caller listed ${payload.length} object(s)` }
  }
  return { ok: false, detail: `unexpected HTTP ${status}` }
}

async function main() {
  const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '')
  const anonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '')
  if (!supabaseUrl || !anonKey) throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required')

  const response = await fetch(`${supabaseUrl}/storage/v1/object/list/chat-attachments`, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prefix: '', limit: 1, offset: 0, sortBy: { column: 'name', order: 'asc' } })
  })
  const payload = await response.json().catch(() => null)
  const result = classifyAnonymousStorageList(response.status, payload)
  console.log(`${result.ok ? 'PASS' : 'FAIL'} anonymous Storage list denied: ${result.detail}`)
  if (!result.ok) process.exit(1)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    console.error(`Anonymous Storage smoke failed safely: ${error?.message || error}`)
    process.exit(1)
  })
}

