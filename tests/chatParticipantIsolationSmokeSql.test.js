import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const smoke = readFileSync(resolve('supabase/shop1-review/003_chat_participant_isolation_smoke.sql'), 'utf8')

describe('local chat participant isolation SQL smoke', () => {
  it('tests own and foreign chat plus Storage visibility', () => {
    expect(smoke).toContain('own_thread_rows <> 1 OR foreign_thread_rows <> 0')
    expect(smoke).toContain('own_storage_rows <> 1 OR foreign_storage_rows <> 0')
  })

  it('keeps all local test writes inside an explicit rollback', () => {
    expect(smoke).toMatch(/^BEGIN;/m)
    expect(smoke).toMatch(/^ROLLBACK;/m)
    expect(smoke).not.toMatch(/^COMMIT;/m)
  })
})

