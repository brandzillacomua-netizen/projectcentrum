import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'
import { parse } from '@babel/parser'
import traverseModule from '@babel/traverse'

const traverse = traverseModule.default || traverseModule
const sourceRoot = join(process.cwd(), 'src')
const baselinePath = join(process.cwd(), 'security', 'client-data-access-baseline.json')
const operations = new Set(['select', 'insert', 'update', 'upsert', 'delete'])
const excludedLegacyFiles = new Set([
  'src/modules/WarehouseModule.jsx'
])

const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name)
  return entry.isDirectory() ? walk(path) : [path]
})

const memberName = node => {
  if (!node) return null
  if (!node.computed && node.property?.type === 'Identifier') return node.property.name
  if (node.computed && node.property?.type === 'StringLiteral') return node.property.value
  return null
}

const memberChainContains = (node, expected) => {
  if (!node) return false
  if (node.type === 'MemberExpression') {
    return memberName(node) === expected || memberChainContains(node.object, expected)
  }
  if (node.type === 'CallExpression') return memberChainContains(node.callee, expected)
  return false
}

const findTable = node => {
  if (!node) return null
  if (node.type === 'CallExpression') {
    const method = node.callee?.type === 'MemberExpression' ? memberName(node.callee) : null
    if (method === 'from' && node.arguments?.[0]?.type === 'StringLiteral') return node.arguments[0].value
    return findTable(node.callee?.object)
  }
  if (node.type === 'MemberExpression') return findTable(node.object)
  return null
}

const moduleScope = file => {
  const normalized = file.split(sep).join('/')
  const moduleMatch = normalized.match(/^src\/modules\/([^/]+)/)
  if (moduleMatch) return moduleMatch[1]
  if (normalized.startsWith('src/contexts/')) return 'shared-context'
  if (normalized.startsWith('src/services/')) return 'shared-service'
  if (normalized.startsWith('src/hooks/')) return 'shared-hook'
  return 'shared-ui'
}

const findings = []
const parseFailures = []
const dynamicTables = []

for (const absolutePath of walk(sourceRoot).filter(file => ['.js', '.jsx'].includes(extname(file)))) {
  const file = relative(process.cwd(), absolutePath).split(sep).join('/')
  if (excludedLegacyFiles.has(file)) continue
  let ast
  try {
    ast = parse(readFileSync(absolutePath, 'utf8'), {
      sourceType: 'module',
      plugins: ['jsx'],
      errorRecovery: false
    })
  } catch (error) {
    parseFailures.push(`${file}:${error.loc?.line || '?'} ${error.message}`)
    continue
  }

  traverse(ast, {
    CallExpression(path) {
      if (path.node.callee?.type !== 'MemberExpression') return
      const operation = memberName(path.node.callee)
      if (operation === 'from' && path.node.arguments?.[0]?.type !== 'StringLiteral') {
        const owner = path.node.callee.object
        const ignoredOwner = owner?.type === 'Identifier' && ['Array', 'Buffer'].includes(owner.name)
        const isStorageBucket = memberChainContains(owner, 'storage')
        const isClientProxyImplementation = file === 'src/supabase.js'
        if (!ignoredOwner && !isStorageBucket && !isClientProxyImplementation) {
          dynamicTables.push({ file, line: path.node.loc?.start?.line || null })
        }
      }
      if (!operations.has(operation)) return
      const table = findTable(path.node.callee.object)
      if (!table) return
      findings.push({
        table,
        operation,
        scope: moduleScope(file),
        file,
        line: path.node.loc?.start?.line || null
      })
    }
  })
}

if (parseFailures.length) {
  console.error(`Client data-access audit could not parse ${parseFailures.length} files:`)
  for (const failure of parseFailures) console.error(`- ${failure}`)
  process.exit(1)
}

for (const file of excludedLegacyFiles) {
  console.warn(`Excluded non-imported legacy file from access inventory: ${file}`)
}

const unique = [...new Map(findings.map(item => [
  `${item.table}:${item.operation}:${item.scope}:${item.file}:${item.line}`,
  item
])).values()]
const byTable = new Map()
for (const item of unique) {
  const entry = byTable.get(item.table) || { operations: new Set(), scopes: new Set(), writes: 0 }
  entry.operations.add(item.operation)
  entry.scopes.add(item.scope)
  if (item.operation !== 'select') entry.writes += 1
  byTable.set(item.table, entry)
}

const summary = [...byTable.entries()]
  .map(([table, entry]) => ({
    table,
    operations: [...entry.operations].sort().join(','),
    scopes: [...entry.scopes].sort().join(','),
    writeSites: entry.writes
  }))
  .sort((a, b) => a.table.localeCompare(b.table))

const checkBaseline = () => {
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const violations = []

  for (const item of unique) {
    const allowed = baseline.tables?.[item.table]
    if (!allowed) {
      violations.push(`${item.file}:${item.line} uses unreviewed table ${item.table}`)
    } else if (!allowed.includes(item.operation)) {
      violations.push(`${item.file}:${item.line} uses unreviewed ${item.operation} on ${item.table}`)
    }
  }

  const dynamicByFile = new Map()
  for (const item of dynamicTables) {
    dynamicByFile.set(item.file, (dynamicByFile.get(item.file) || 0) + 1)
  }
  for (const [file, count] of dynamicByFile) {
    const reviewed = baseline.dynamicAccess?.[file]
    if (!reviewed) {
      violations.push(`${file} contains ${count} unreviewed non-literal .from(...) call(s)`)
    } else if (count > reviewed.maxSites) {
      violations.push(`${file} contains ${count} non-literal .from(...) calls; reviewed maximum is ${reviewed.maxSites}`)
    }
  }

  if (violations.length) {
    console.error('Client data-access contract violations:')
    for (const violation of violations) console.error(`- ${violation}`)
    process.exit(1)
  }

  console.log(`Client data-access contract passed: ${summary.length} tables, ${unique.length} literal call sites.`)
  console.log(`Reviewed dynamic access: ${dynamicTables.length} call sites across ${dynamicByFile.size} files.`)
}

if (process.argv.includes('--check')) {
  checkBaseline()
} else if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, findings: unique, dynamicTables }, null, 2))
} else {
  console.log(`Client data-access inventory: ${summary.length} literal tables, ${unique.length} call sites.`)
  console.table(summary)
  if (dynamicTables.length) console.warn(`Non-literal .from(...) calls: ${dynamicTables.length}`)
}
