import { readdirSync, readFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const absolute = join(directory, entry.name)
  return entry.isDirectory() ? walk(absolute) : [absolute]
})

const sourceFiles = walk(join(process.cwd(), 'src'))
  .filter(file => ['.js', '.jsx', '.ts', '.tsx'].includes(extname(file)))
const tableNames = [...new Set(sourceFiles.flatMap(file => {
  const source = readFileSync(file, 'utf8')
  return [...source.matchAll(/\.from\(['"]([a-zA-Z0-9_]+)['"]\)/g)].map(match => match[1])
}))].sort()

const supabaseSource = readFileSync(join(process.cwd(), 'src', 'supabase.js'), 'utf8')
const configuredUrl = process.env.SUPABASE_AUDIT_URL || process.env.VITE_SUPABASE_URL
const configuredKey = process.env.SUPABASE_AUDIT_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
const fallbackUrl = supabaseSource.match(/export const PROD_URL[^\n]*\n\s*\?[^\n]*\n\s*:\s*RAW_SUPABASE_URL/) 
  ? 'https://hurzutjytlcvtbvihnry.supabase.co'
  : null
const fallbackKey = supabaseSource.match(/export const PROD_ANON_KEY =[^\n]*\|\| '([^']+)'/)?.[1]
const supabaseUrl = String(configuredUrl || fallbackUrl || '').replace(/\/$/, '')

const jwtRef = token => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).ref || null
  } catch {
    return null
  }
}

const urlRef = (() => {
  try { return new URL(supabaseUrl).hostname.split('.')[0] } catch { return null }
})()
const anonKey = configuredKey && jwtRef(configuredKey) === urlRef ? configuredKey : fallbackKey

if (!supabaseUrl || !anonKey) {
  console.error('Missing SUPABASE_AUDIT_URL / SUPABASE_AUDIT_ANON_KEY configuration.')
  process.exit(1)
}

const inspectTable = async table => {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  })
  let payload = null
  try { payload = await response.json() } catch { /* status is enough */ }
  return {
    table,
    status: response.status,
    rowExposed: response.ok && Array.isArray(payload) && payload.length > 0
  }
}

const results = []
for (let offset = 0; offset < tableNames.length; offset += 6) {
  results.push(...await Promise.all(tableNames.slice(offset, offset + 6).map(inspectTable)))
}

const exposed = results.filter(result => result.rowExposed)
const reachable = results.filter(result => result.status === 200)
console.log(`Anonymous surface audit: ${tableNames.length} client tables checked.`)
console.log(`REST-reachable: ${reachable.length}; at least one row exposed: ${exposed.length}.`)
for (const result of exposed) console.log(`EXPOSED ${result.table}`)

if (exposed.length > 0) process.exitCode = 2

