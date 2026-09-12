import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const migrationDir = join(process.cwd(), 'supabase', 'migrations')
const guardedFrom = '20260912120000'
const files = readdirSync(migrationDir)
  .filter(name => name.endsWith('.sql') && name >= guardedFrom)
  .sort()
const findings = []
const allowedAnonymousFunctions = new Set([
  'public.rpc_public_machine_call_context',
  'public.rpc_public_create_machine_call'
])

for (const file of files) {
  const sql = readFileSync(join(migrationDir, file), 'utf8')
    .replace(/--.*$/gm, '')

  if (/FOR\s+ALL\s+TO\s+(?:PUBLIC|anon)\b/i.test(sql)) {
    findings.push(`${file}: FOR ALL policy for PUBLIC/anon is forbidden`)
  }
  if (/GRANT\s+[\s\S]{0,120}\b(?:UPDATE|DELETE|TRUNCATE|REFERENCES|TRIGGER)\b[\s\S]{0,120}\bTO\s+(?:PUBLIC|anon)\b/i.test(sql)) {
    findings.push(`${file}: mutating table privileges for PUBLIC/anon are forbidden`)
  }
  if (/GRANT\s+ALL(?:\s+PRIVILEGES)?\s+ON\s+(?:TABLE\s+)?[\w.,\s]+\s+TO\s+authenticated\b/i.test(sql)) {
    findings.push(`${file}: broad ALL table privileges for authenticated are forbidden`)
  }
  if (/FOR\s+ALL\s+TO\s+authenticated\b/i.test(sql)) {
    findings.push(`${file}: broad FOR ALL policy for authenticated is forbidden`)
  }

  for (const grant of sql.matchAll(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+([\w.]+)\s*\([^;]*?\)\s+TO\s+([^;]+);/gi)) {
    const functionName = grant[1].toLowerCase()
    const roles = grant[2].toLowerCase().split(',').map(role => role.trim())
    if ((roles.includes('anon') || roles.includes('public')) && !allowedAnonymousFunctions.has(functionName)) {
      findings.push(`${file}: anonymous EXECUTE is forbidden for ${functionName}`)
    }
  }

  const functions = sql.split(/(?=CREATE\s+OR\s+REPLACE\s+FUNCTION)/i).slice(1)
  for (const block of functions) {
    const header = block.slice(0, block.indexOf('AS $$') > 0 ? block.indexOf('AS $$') : 800)
    if (/SECURITY\s+DEFINER/i.test(header) && !/SET\s+search_path\s*=/i.test(header)) {
      const name = header.match(/FUNCTION\s+([\w.]+)/i)?.[1] || 'unknown function'
      findings.push(`${file}: ${name} is SECURITY DEFINER without fixed search_path`)
    }
  }
}

if (findings.length) {
  console.error(`RLS boundary check failed:\n${findings.map(item => `- ${item}`).join('\n')}`)
  process.exit(1)
}
console.log(`RLS boundary check passed (${files.length} guarded migrations inspected).`)
