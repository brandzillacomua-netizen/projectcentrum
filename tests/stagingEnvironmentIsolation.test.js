import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { isTestEnvironment, getActiveSupabase, prodClient, stagingClient } from '../src/supabase.js'
import { getActiveCacheKey } from '../src/contexts/data/dataProfiles.js'

describe('Staging Environment Isolation & Multi-DB Routing Tests', () => {
  const originalLocation = window.location

  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
    delete window.location
    window.location = originalLocation
  })

  it('correctly detects production environment by default', () => {
    delete window.location
    window.location = new URL('https://localhost:5173/master')

    expect(isTestEnvironment()).toBe(false)
    expect(getActiveSupabase()).toBe(prodClient)
    expect(getActiveCacheKey()).toBe('MES_APP_CACHE_V13')
  })

  it('correctly detects test environment via /test pathname and isolates cache keys', () => {
    delete window.location
    window.location = new URL('https://localhost:5173/test/master')

    expect(isTestEnvironment()).toBe(true)
    expect(getActiveSupabase()).toBe(stagingClient)
    expect(getActiveCacheKey()).toBe('MES_APP_CACHE_STAGING_V1')
  })

  it('correctly detects test environment via centrum_env localStorage flag', () => {
    delete window.location
    window.location = new URL('https://localhost:5173/')
    localStorage.setItem('centrum_env', 'test')

    expect(isTestEnvironment()).toBe(true)
    expect(getActiveSupabase()).toBe(stagingClient)
    expect(getActiveCacheKey()).toBe('MES_APP_CACHE_STAGING_V1')
  })

  it('env=prod query parameter forces return to PROD and clears centrum_env flag', () => {
    localStorage.setItem('centrum_env', 'test')
    delete window.location
    window.location = new URL('https://localhost:5173/master?env=prod')

    expect(isTestEnvironment()).toBe(false)
    expect(localStorage.getItem('centrum_env')).toBeNull()
    expect(getActiveSupabase()).toBe(prodClient)
    expect(getActiveCacheKey()).toBe('MES_APP_CACHE_V13')
  })
})
