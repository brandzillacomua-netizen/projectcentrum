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

  it('rejects invalid Supabase Auth credentials without legacy password fallback', async () => {
    // Mock signInWithPassword so unit tests don't make real network calls in CI
    const authSpy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: null,
      error: new Error('Invalid login credentials')
    })

    const rpcSpy = vi.spyOn(supabase, 'rpc')

    const auth = createAuthActions({
      currentUser,
      setCurrentUser,
      setSystemUsers,
      clearAllData,
      setSessionLoading
    })

    const result = await auth.login('test_admin', 'Secret123!')

    expect(result.success).toBe(false)
    expect(rpcSpy).not.toHaveBeenCalled()
    expect(localStorage.getItem('MES_SESSION_USER')).toBeNull()

    rpcSpy.mockRestore()
    authSpy.mockRestore()
  })

  it('login succeeds with JWT profile and never duplicates JWT in custom storage', async () => {
    const authSpy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
      data: { session: { access_token: 'fake-jwt-token-123', user: { id: 'uuid-123' } } },
      error: null
    })
    const rpcSpy = vi.spyOn(supabase, 'rpc').mockImplementation(name => Promise.resolve({
      data: name === 'rpc_current_user_profile' ? { id: 1, login: 'test_admin', position: 'Адмін' } : null,
      error: null
    }))

    const auth = createAuthActions({
      currentUser,
      setCurrentUser,
      setSystemUsers,
      clearAllData,
      setSessionLoading
    })

    const res = await auth.login('test_admin', 'Secret123!')
    expect(res.success).toBe(true)
    expect(localStorage.getItem('BACKEND_TOKEN')).toBeNull()
    expect(localStorage.getItem('MES_SESSION_STRICT')).toBe('true')

    authSpy.mockRestore()
    rpcSpy.mockRestore()
  })

  it('upsertUser uses auth-bound RPC without caller-controlled admin ID', async () => {
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
      p_user_payload: expect.objectContaining({ login: 'new_operator' })
    })

    rpcSpy.mockRestore()
  })

  it('deleteUser uses auth-bound RPC and updates systemUsers state', async () => {
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
