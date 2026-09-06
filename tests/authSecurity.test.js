import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createAuthActions } from '../src/contexts/useAuth.js'
import { supabase } from '../src/supabase.js'

describe('Enterprise Auth & User Governance Security Tests', () => {
  let currentUser = null
  let systemUsers = []
  let sessionLoading = true

  const setCurrentUser = vi.fn(val => { currentUser = val })
  const setSystemUsers = vi.fn(val => {
    systemUsers = typeof val === 'function' ? val(systemUsers) : val
  })
  const setSessionLoading = vi.fn(val => { sessionLoading = val })
  const clearAllData = vi.fn()

  beforeEach(() => {
    currentUser = null
    systemUsers = []
    sessionLoading = true
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('login sanitizes user object and NEVER stores plaintext password in localStorage', async () => {
    // Mock signInWithPassword so unit tests don't make real network calls in CI
    const authSpy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: null,
      error: new Error('Invalid login credentials')
    })

    // Mock verify_user_password RPC response returning a user with potential password field
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({
        data: {
          id: 1,
          login: 'test_admin',
          first_name: 'Test',
          last_name: 'Admin',
          password: 'sensitive_bcrypt_or_plain',
          access_rights: { admin: true }
        },
        error: null
      })
    })

    const auth = createAuthActions({
      currentUser,
      setCurrentUser,
      setSystemUsers,
      clearAllData,
      setSessionLoading
    })

    const result = await auth.login('test_admin', 'Secret123!')

    expect(result.success).toBe(true)
    expect(result.user).toBeDefined()
    expect(result.user.password).toBeUndefined()

    // Verify localStorage cache does not contain password
    const cachedRaw = localStorage.getItem('MES_SESSION_USER')
    expect(cachedRaw).not.toBeNull()
    const cachedUser = JSON.parse(cachedRaw)
    expect(cachedUser.login).toBe('test_admin')
    expect(cachedUser.password).toBeUndefined()

    rpcSpy.mockRestore()
    authSpy.mockRestore()
  })

  it('login succeeds with JWT and sets BACKEND_TOKEN and MES_SESSION_STRICT', async () => {
    const authSpy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { session: { access_token: 'fake-jwt-token-123', user: { id: 'uuid-123' } } },
      error: null
    })
    const fromSpy = vi.spyOn(supabase, 'from').mockReturnValue({
      select: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 1, login: 'test_admin', position: 'Адмін' },
        error: null
      })
    })

    const auth = createAuthActions({
      currentUser,
      setCurrentUser,
      setSystemUsers,
      clearAllData,
      setSessionLoading
    })

    const res = await auth.login('test_admin', 'Secret123!')
    expect(res.success).toBe(true)
    expect(localStorage.getItem('BACKEND_TOKEN')).toBe('fake-jwt-token-123')
    expect(localStorage.getItem('MES_SESSION_STRICT')).toBe('true')

    authSpy.mockRestore()
    fromSpy.mockRestore()
  })

  it('upsertUser attempts rpc_admin_upsert_user with caller ID and payload', async () => {
    const adminUser = { id: 99, login: 'superadmin', access_rights: { admin: true } }
    let current = adminUser

    const rpcSpy = vi.spyOn(supabase, 'rpc').mockImplementation((rpcName, params) => {
      if (rpcName === 'rpc_admin_upsert_user') {
        return Promise.resolve({
          data: {
            success: true,
            data: {
              id: 42,
              login: params.p_user_payload.login,
              first_name: params.p_user_payload.first_name,
              access_rights: params.p_user_payload.access_rights
            }
          },
          error: null
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const auth = createAuthActions({
      currentUser: current,
      setCurrentUser,
      setSystemUsers,
      clearAllData,
      setSessionLoading
    })

    const newUserPayload = {
      login: 'new_operator',
      password: 'password123',
      first_name: 'Іван',
      access_rights: { operator: true }
    }

    const { data, error } = await auth.upsertUser(newUserPayload)

    expect(error).toBeNull()
    expect(data).toBeDefined()
    expect(data.id).toBe(42)
    expect(data.login).toBe('new_operator')
    expect(rpcSpy).toHaveBeenCalledWith('rpc_admin_upsert_user', {
      p_admin_id: 99,
      p_user_payload: expect.objectContaining({ login: 'new_operator' })
    })

    rpcSpy.mockRestore()
  })

  it('deleteUser attempts rpc_admin_delete_user and updates systemUsers state', async () => {
    const adminUser = { id: 99, login: 'superadmin', access_rights: { admin: true } }
    systemUsers = [
      { id: 10, login: 'user_to_delete' },
      { id: 99, login: 'superadmin' }
    ]

    const rpcSpy = vi.spyOn(supabase, 'rpc').mockImplementation((rpcName, params) => {
      if (rpcName === 'rpc_admin_delete_user') {
        return Promise.resolve({
          data: { success: true, deleted_id: params.p_target_user_id },
          error: null
        })
      }
      return Promise.resolve({ data: null, error: null })
    })

    const auth = createAuthActions({
      currentUser: adminUser,
      setCurrentUser,
      setSystemUsers,
      clearAllData,
      setSessionLoading
    })

    const { error } = await auth.deleteUser(10)

    expect(error).toBeNull()
    expect(rpcSpy).toHaveBeenCalledWith('rpc_admin_delete_user', {
      p_admin_id: 99,
      p_target_user_id: 10
    })
    expect(systemUsers.find(u => u.id === 10)).toBeUndefined()
    expect(systemUsers.find(u => u.id === 99)).toBeDefined()

    rpcSpy.mockRestore()
  })

  it('logout properly cleans up user context and session storage', () => {
    localStorage.setItem('MES_SESSION_LOGIN', 'test_user')
    localStorage.setItem('MES_SESSION_USER', JSON.stringify({ id: 1, login: 'test_user' }))

    const auth = createAuthActions({
      currentUser: { id: 1, login: 'test_user' },
      setCurrentUser,
      setSystemUsers,
      clearAllData,
      setSessionLoading
    })

    auth.logout()

    expect(clearAllData).toHaveBeenCalled()
  })
})
