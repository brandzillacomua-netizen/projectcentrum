import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260912225500_add_updated_at_to_realtime_tables.sql', import.meta.url),
  'utf8'
).toLowerCase()

const diagnostic = readFileSync(
  new URL('../supabase/diagnostics/updated_at_realtime_postcondition.sql', import.meta.url),
  'utf8'
).toLowerCase()

const tables = ['tasks', 'orders', 'work_cards', 'material_requests']

describe('realtime updated_at migration contract', () => {
  it.each(tables)('covers %s with a column, trigger, and index', (table) => {
    expect(migration).toContain(`alter table public.${table} add column if not exists updated_at`)
    expect(migration).toContain(`create trigger trg_${table}_updated_at`)
    expect(migration).toContain(`create index if not exists idx_${table}_updated_at`)
  })

  it('uses one deterministic trigger function', () => {
    expect(migration).toContain('create or replace function public.auto_update_updated_at()')
    expect(migration).toContain('new.updated_at = now()')
  })

  it('has a read-only postcondition for every deployed object', () => {
    expect(diagnostic).toContain("'status', case")
    expect(diagnostic).toContain('columns_ready = 4')
    expect(diagnostic).toContain('triggers_ready = 4')
    expect(diagnostic).toContain('indexes_ready = 4')
    for (const table of tables) expect(diagnostic).toContain(`('${table}')`)
  })
})
