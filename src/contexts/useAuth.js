import { supabase } from '../supabase'
import { apiService } from '../services/apiDispatcher'

const USER_CACHE_KEY = 'MES_SESSION_USER'

/**
 * Auth & User Management hooks
 * Returns: { login, logout, upsertUser, deleteUser, searchCustomers }
 */
export function createAuthActions({ currentUser, setCurrentUser, setSystemUsers, fetchData, clearAllData }) {

  const login = async (loginName, password) => {
    // ── Step 1: Authenticate via Supabase (primary, fast) ──────────────────
    const { data } = await supabase
      .from('system_users')
      .select('id,login,password,first_name,last_name,position,access_rights,department,shift')
      .eq('login', loginName)
      .maybeSingle()

    if (!data || data.password !== password) {
      return { success: false, error: 'Невірний логін або пароль' }
    }

    // ── Step 2: Fire-and-forget Rust backend sync (non-blocking) ────────────
    let token = null
    apiService.submitLogin(loginName, password)
      .then(backendRes => {
        const t = backendRes?.token || backendRes?.accessToken || backendRes?.data?.token
        if (t) {
          localStorage.setItem('BACKEND_TOKEN', t)
          setCurrentUser(prev => prev ? { ...prev, token: t } : prev)
        }
      })
      .catch(() => {}) // silently ignore — Supabase is master

    const userWithToken = { ...data, token }
    setCurrentUser(userWithToken)
    localStorage.setItem('MES_SESSION_LOGIN', data.login)
    // Cache full user object for instant session restore on next page load
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data))

    // Force data refresh on successful login without blocking the login UI
    if (fetchData) {
      fetchData(true).catch(err => {
        console.error('Failed to force refresh data after login:', err)
      })
    }

    return { success: true, user: userWithToken }
  }

  const logout = () => {
    if (clearAllData) {
      clearAllData()
    } else {
      setCurrentUser(null)
      localStorage.removeItem('MES_SESSION_LOGIN')
      localStorage.removeItem('BACKEND_TOKEN')
      localStorage.removeItem(USER_CACHE_KEY)
    }
  }

  const upsertUser = async (userData) => {
    await apiService.submitUserAction(userData, null, currentUser?.token)
    const payload = { ...userData }
    if (!payload.id) delete payload.id
    const { data, error } = await supabase.from('system_users').upsert([payload]).select()
    const result = (data && data.length > 0) ? data[0] : null
    if (!error && result) {
      setSystemUsers(prev => {
        const idx = prev.findIndex(u => u.id === result.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = result; return next }
        return [...prev, result]
      })
      if (currentUser && currentUser.id === result.id) setCurrentUser(result)
    }
    return { data: result, error }
  }

  const deleteUser = async (id) => {
    const { error } = await supabase.from('system_users').delete().eq('id', id)
    if (!error) setSystemUsers(prev => prev.filter(u => u.id !== id))
    return { error }
  }

  const searchCustomers = async (query, setCustomers) => {
    if (!query) return
    const { data } = await supabase
      .from('customers')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(5)
    if (data) setCustomers(data)
  }

  return { login, logout, upsertUser, deleteUser, searchCustomers }
}
