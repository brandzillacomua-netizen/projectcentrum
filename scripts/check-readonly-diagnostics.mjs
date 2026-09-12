import { readFileSync, readdirSync } from 'node:fs'
import { extname, join } from 'node:path'

const diagnosticsRoot = join(process.cwd(), 'supabase', 'diagnostics')
const forbidden = /\b(insert|update|delete|merge|alter|drop|create|grant|revoke|truncate|copy|call|do|execute|vacuum|reindex|cluster|refresh)\b/i

const stripNonExecutableText = sql => sql
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/--[^\r\n]*/g, ' ')
  .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, ' ')
  .replace(/'(?:''|[^'])*'/g, "''")
  .replace(/"(?:""|[^"])*"/g, '""')

const sqlFiles = readdirSync(diagnosticsRoot, { withFileTypes: true })
  .filter(entry => entry.isFile() && extname(entry.name).toLowerCase() === '.sql')
  .map(entry => join(diagnosticsRoot, entry.name))

const violations = []
for (const file of sqlFiles) {
  const executable = stripNonExecutableText(readFileSync(file, 'utf8'))
  const match = executable.match(forbidden)
  if (match) violations.push(`${file}: contains forbidden statement token ${match[1].toUpperCase()}`)
}

if (violations.length) {
  console.error('Read-only diagnostic boundary violations:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log(`Read-only diagnostic check passed (${sqlFiles.length} SQL file(s)).`)
