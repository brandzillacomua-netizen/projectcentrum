import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const stateSource = readFileSync(
  new URL('../src/contexts/data/dataState.ts', import.meta.url),
  'utf8'
)
const realtimeSource = readFileSync(
  new URL('../src/contexts/data/dataRealtime.js', import.meta.url),
  'utf8'
)

describe('reconnect catch-up degradation contract', () => {
  it('distinguishes a failed incremental query from a valid empty result', () => {
    expect(stateSource).toContain('return { table, rows: [], failed: true }')
    expect(stateSource).toContain('return { table, rows: [], failed: false }')
    expect(stateSource).toContain('failedTables: results.filter(')
  })

  it('forces a full refresh only for failed tables', () => {
    expect(realtimeSource).toContain('catchUpWithFullRefreshFallback')
    expect(realtimeSource).toContain('delete targetRefreshLastRef.current[getTargetRefreshKey(tableName)]')
    expect(realtimeSource).toContain('await fetchData(failedTables)')
  })
})
