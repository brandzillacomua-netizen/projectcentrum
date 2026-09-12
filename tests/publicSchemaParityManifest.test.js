import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync(
  new URL('../supabase/diagnostics/public_schema_parity_manifest.sql', import.meta.url),
  'utf8'
).toLowerCase()

describe('public schema parity manifest', () => {
  it('covers the database contracts that can change application behavior', () => {
    for (const kind of [
      'relation',
      'column',
      'constraint',
      'index',
      'trigger',
      'routine',
      'policy',
      'table_acl',
      'routine_acl',
      'default_acl',
      'enum_value'
    ]) {
      expect(sql).toContain(`'${kind}'`)
    }
  })

  it('reads catalog metadata only and emits per-object fingerprints', () => {
    expect(sql).toContain("'manifest_version', '2026-09-13.v1'")
    expect(sql).toContain("'global_fingerprint'")
    expect(sql).toContain("'objects'")
    expect(sql).toContain('pg_get_functiondef')
    expect(sql).not.toMatch(/\b(insert|update|delete|alter|drop|grant|revoke|truncate)\s+/)
  })

  it('excludes extension-owned routines to avoid platform-version noise', () => {
    expect(sql).toContain('extension_routines.routine_oid is null')
    expect(sql).toContain("dependency.deptype = 'e'")
  })
})
