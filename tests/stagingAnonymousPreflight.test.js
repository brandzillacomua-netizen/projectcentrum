import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const sql = readFileSync(
  new URL('../supabase/diagnostics/staging_anonymous_surface_preflight.sql', import.meta.url),
  'utf8'
).toLowerCase()

describe('staging anonymous surface preflight', () => {
  it('inventories every anonymous access path without application data queries', () => {
    expect(sql).toContain('information_schema.table_privileges')
    expect(sql).toContain('information_schema.column_privileges')
    expect(sql).toContain('pg_policies')
    expect(sql).toContain('has_function_privilege')
    expect(sql).toContain('pg_default_acl')
    expect(sql).toContain('relrowsecurity')
    expect(sql).toContain("namespace.nspname = 'public'")
    expect(sql).toContain('from exposed_policies as policy')
  })

  it('reports locked only when every unsafe count is zero', () => {
    expect(sql).toContain("then 'locked'")
    expect(sql).toContain("else 'exposed'")
    expect(sql).toContain('table_privileges = 0')
    expect(sql).toContain('column_privileges = 0')
    expect(sql).toContain('exposed_policies = 0')
    expect(sql).toContain('non_extension_routines = 0')
    expect(sql).toContain('tables_without_rls = 0')
    expect(sql).toContain('unsafe_defaults = 0')
  })
})
