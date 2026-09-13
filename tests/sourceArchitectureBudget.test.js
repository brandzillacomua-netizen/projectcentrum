import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const workspaceRoot = fileURLToPath(new URL('..', import.meta.url))
const sourceRoot = fileURLToPath(new URL('../src', import.meta.url))

const readSource = path => {
  const fileUrl = new URL(`../${path}`, import.meta.url)
  if (existsSync(fileUrl)) return readFileSync(fileUrl, 'utf8')
  if (path.endsWith('.jsx')) {
    const tsxUrl = new URL(`../${path.replace('.jsx', '.tsx')}`, import.meta.url)
    if (existsSync(tsxUrl)) return readFileSync(tsxUrl, 'utf8')
  }
  throw new Error(`File not found: ${path}`)
}

const countLines = path => readSource(path).split(/\r?\n/).length

const sourceFiles = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = join(directory, entry.name)
  if (entry.isDirectory()) return sourceFiles(path)
  return ['.js', '.jsx', '.ts', '.tsx', '.mjs'].includes(extname(entry.name)) ? [path] : []
})

describe('source architecture regression budget', () => {
  const budgets = {
    'src/MESContext.jsx': 150,
    'src/App.jsx': 950,
    'src/modules/MasterModule.tsx': 500,
    'src/modules/Master/hooks/useMasterState.js': 1200,
    'src/modules/EngineerV2Module.tsx': 200,
    'src/modules/WarehouseFGPModule.jsx': 2670,
    'src/modules/Shop1ForemanModule.jsx': 200,
    'src/modules/Foreman/components/ForemanReportModal.jsx': 1400
  }

  for (const [path, maximumLines] of Object.entries(budgets)) {
    it(`keeps ${path} within ${maximumLines} lines`, () => {
      expect(countLines(path), `${path} grew beyond its decomposition budget`)
        .toBeLessThanOrEqual(maximumLines)
    })
  }

  it('keeps superseded monoliths outside the runtime dependency graph', () => {
    const forbiddenImport = /(?:from\s*|import\s*\()\s*['"][^'"]*(?:MasterModule_v3|ForemanWorkplace)/
    const importedBy = sourceFiles(sourceRoot)
      .filter(path => forbiddenImport.test(readFileSync(path, 'utf8')))
      .map(path => relative(workspaceRoot, path))

    expect(importedBy).toEqual([])
  })
})
