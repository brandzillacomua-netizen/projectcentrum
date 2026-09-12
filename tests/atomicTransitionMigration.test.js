import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../supabase/migrations/20260912210000_repair_atomic_card_transition.sql', import.meta.url),
  'utf8'
)
const functionBody = migration.slice(
  migration.indexOf('CREATE OR REPLACE FUNCTION public.rpc_transition_work_card_atomic'),
  migration.indexOf('REVOKE ALL ON FUNCTION public.rpc_transition_work_card_atomic')
)

describe('atomic transition database migration contract', () => {
  it('uses the production work_cards schema and preserves the five-argument API', () => {
    expect(functionBody).toContain('p_session_id TEXT DEFAULT NULL')
    expect(functionBody).toContain('v_current_card.operator_name')
    expect(functionBody).toContain('operator_name = CASE')
    expect(functionBody).not.toMatch(/v_current_card\.operator(?!_name)/)
    expect(functionBody.toLowerCase()).not.toContain('updated_at = now()')
  })

  it('is authenticated, schema-pinned, allowlisted, and atomically writes history', () => {
    expect(migration).toContain('SET search_path = pg_catalog, public, auth')
    expect(migration).toContain('v_caller_id := public.mes_current_system_user_id()')
    expect(migration).toContain("RAISE EXCEPTION 'Unsupported work-card update field: %'")
    expect(migration).toContain('INSERT INTO public.work_card_history')
    expect(migration).toContain('FROM PUBLIC, anon, authenticated')
    expect(migration).toContain('TO authenticated, service_role')
  })

  it('returns the client idempotency contract', () => {
    expect(migration).toContain("'already_processed', TRUE")
    expect(migration).toContain("'reason', 'idempotent_replay'")
  })
})
