import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { requireMesUser } from '../api/_security.js'

const read = path => readFileSync(path, 'utf8')

describe('P0 enterprise security boundaries', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('keeps Nova Poshta credentials and calls behind an authenticated server gateway', () => {
    const client = read('src/services/novaPoshtaService.js')
    const gateway = read('api/nova-poshta.js')
    expect(client).not.toContain('api.novaposhta.ua/v2.0')
    expect(client).not.toContain(['VITE', 'NOVA', 'POSHTA', 'API', 'KEY'].join('_'))
    expect(gateway).toContain('requireMesUser')
    expect(gateway).toContain('NOVA_POSHTA_API_KEY')
    expect(gateway).toContain('ALLOWED_OPERATIONS')
  })

  it('keeps Telegram credentials outside browser code', () => {
    const transport = read('src/services/alerting/telegramTransport.js')
    const gateway = read('api/telegram-alert.js')
    expect(transport).not.toContain('api.telegram.org/bot')
    expect(transport).not.toContain(['VITE', 'TELEGRAM', 'BOT', 'TOKEN'].join('_'))
    expect(gateway).toContain('requireMesUser')
    expect(gateway).toContain('TELEGRAM_BOT_TOKEN')
  })

  it('fails Core Engine authentication closed', () => {
    const middleware = read('server/src/middleware/authMiddleware.js')
    const dispatcher = read('src/services/apiDispatcher.js')
    expect(middleware).toContain('Bearer token required')
    expect(middleware).not.toContain('anonymous-shadow-user')
    expect(dispatcher).toContain('SHADOW_TESTING_MODE: false')
  })

  it('binds database identity and admin operations to auth.uid()', () => {
    const migration = read('supabase/migrations/20260912120000_p0_enterprise_identity_hardening.sql')
    const authClient = read('src/contexts/useAuth.js')
    expect(migration).toContain('auth_user_id = auth.uid()')
    expect(migration).toContain('mes_current_system_user_id()')
    expect(migration).toContain('REVOKE ALL ON FUNCTION public.verify_user_password')
    expect(authClient).not.toContain("rpc('verify_user_password'")
    expect(authClient).not.toContain('p_admin_id:')
  })

  it('ships baseline browser security headers', () => {
    const vercel = read('vercel.json')
    expect(vercel).toContain('Content-Security-Policy')
    expect(vercel).toContain('Strict-Transport-Security')
    expect(vercel).toContain('Permissions-Policy')
  })

  it('keeps RLS and production smoke gates in CI', () => {
    const packageJson = read('package.json')
    const workflow = read('.github/workflows/ci.yml')
    expect(packageJson).toContain('security:rls')
    expect(packageJson).toContain('smoke:production')
    expect(workflow).toContain('npm run security:rls')
  })

  it('removes direct anonymous data access and allow-lists only QR RPCs', () => {
    const expand = read('supabase/migrations/20260912130000_public_machine_call_rpc_expand.sql')
    const contract = read('supabase/migrations/20260912133000_public_machine_call_contract.sql')
    const lockdown = read('supabase/migrations/20260912140000_lock_anonymous_surface.sql')
    const publicClient = read('src/modules/MachineCallModule.jsx')

    expect(expand).toContain('pg_advisory_xact_lock')
    expect(expand).toContain("p_called_role NOT IN ('master', 'engineer', 'quality')")
    expect(expand).toContain(`ANY (ARRAY['{"master": true}'::JSONB, '{"foreman": true}'::JSONB])`)
    expect(contract).toContain('REVOKE ALL PRIVILEGES ON TABLE public.machine_calls FROM anon')
    expect(lockdown).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon')
    expect(lockdown).toContain('REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon')
    expect(publicClient).not.toContain("from('machine_calls')")
    expect(publicClient).not.toContain("from('system_users')")
    expect(publicClient).not.toContain("from('machines')")
  })

  it('verifies serverless JWTs even when Vite build variables are absent at runtime', () => {
    const security = read('api/_security.js')
    expect(security).toContain('PUBLIC_PROJECTS')
    expect(security).toContain('/auth/v1/user')
    expect(security).toContain('readUnverifiedProjectRef')
  })

  it('routes a production user JWT to the public project config and validates it upstream', async () => {
    const jwtPart = Buffer.from(JSON.stringify({ iss: 'https://hurzutjytlcvtbvihnry.supabase.co/auth/v1' })).toString('base64url')
    const token = `header.${jwtPart}.signature`
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 7, access_rights: { admin: true } }) })
    vi.stubGlobal('fetch', fetchMock)
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }

    const profile = await requireMesUser({ headers: { authorization: `Bearer ${token}` } }, res, ['admin'])

    expect(profile.id).toBe(7)
    expect(fetchMock).toHaveBeenNthCalledWith(1, 'https://hurzutjytlcvtbvihnry.supabase.co/auth/v1/user', expect.any(Object))
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/rpc/rpc_current_user_profile', expect.objectContaining({ method: 'POST' }))
  })
})
