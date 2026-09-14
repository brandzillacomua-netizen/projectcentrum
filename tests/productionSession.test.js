import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearProductionSessionCache,
  restoreProductionSession
} from '../src/auth/productionSession.js'

describe('production session bootstrap', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  it('rejects a cached UI profile when the real PROD session is missing', async () => {
    localStorage.setItem('MES_SESSION_USER', JSON.stringify({ id: 'user-1', login: 'admin' }))
    localStorage.setItem('MES_SESSION_LOGIN', 'admin')
    localStorage.setItem('MES_SESSION_STRICT', 'true')

    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
      rpc: vi.fn()
    }

    await expect(restoreProductionSession(client)).resolves.toBeNull()
    expect(client.rpc).not.toHaveBeenCalled()
    expect(localStorage.getItem('MES_SESSION_USER')).toBeNull()
    expect(localStorage.getItem('MES_SESSION_LOGIN')).toBeNull()
    expect(localStorage.getItem('MES_SESSION_STRICT')).toBeNull()
  })

  it('revalidates a cached profile through the protected RPC', async () => {
    const cachedUser = { id: 'user-1', login: 'admin' }
    const currentProfile = { id: 'user-1', login: 'admin', position: 'Director' }
    localStorage.setItem('MES_SESSION_USER', JSON.stringify(cachedUser))
    localStorage.setItem('MES_SESSION_STRICT', 'true')

    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'valid-jwt', user: { id: 'auth-user-1' } } },
          error: null
        }),
        signOut: vi.fn()
      },
      rpc: vi.fn().mockResolvedValue({ data: currentProfile, error: null })
    }

    await expect(restoreProductionSession(client)).resolves.toEqual(currentProfile)
    expect(client.rpc).toHaveBeenCalledWith('rpc_current_user_profile')
    expect(JSON.parse(localStorage.getItem('MES_SESSION_USER'))).toEqual(currentProfile)
  })

  it('rebuilds a missing profile through an authenticated RPC', async () => {
    const profile = { id: 'user-1', login: 'admin' }
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { access_token: 'valid-jwt', user: { id: 'auth-user-1' } } },
          error: null
        }),
        signOut: vi.fn()
      },
      rpc: vi.fn().mockResolvedValue({ data: profile, error: null })
    }

    await expect(restoreProductionSession(client)).resolves.toEqual(profile)
    expect(client.rpc).toHaveBeenCalledWith('rpc_current_user_profile')
    expect(JSON.parse(localStorage.getItem('MES_SESSION_USER'))).toEqual(profile)
    expect(localStorage.getItem('MES_SESSION_STRICT')).toBe('true')
  })

  it('clears every PROD compatibility key together', () => {
    for (const key of ['MES_SESSION_USER', 'MES_SESSION_LOGIN', 'MES_SESSION_STRICT', 'BACKEND_TOKEN']) {
      localStorage.setItem(key, 'stale')
    }

    clearProductionSessionCache()

    for (const key of ['MES_SESSION_USER', 'MES_SESSION_LOGIN', 'MES_SESSION_STRICT', 'BACKEND_TOKEN']) {
      expect(localStorage.getItem(key)).toBeNull()
    }
  })
})
