import { supabase, isTestEnvironment } from '../supabase'
import { sentryLogger } from '../services/sentryLogger'

const getAuthKeys = () => {
  const isTest = isTestEnvironment()
  return {
    userKey: isTest ? 'MES_SESSION_USER_STAGING' : 'MES_SESSION_USER',
    loginKey: isTest ? 'MES_SESSION_LOGIN_STAGING' : 'MES_SESSION_LOGIN',
    strictKey: isTest ? 'MES_SESSION_STRICT_STAGING' : 'MES_SESSION_STRICT'
  }
}

/**
 * Auth & User Management hooks
 * Returns: { login, logout, upsertUser, deleteUser, searchCustomers }
 */
export function createAuthActions({ currentUser, setCurrentUser, setSystemUsers, clearAllData, setSessionLoading }) {

  const login = async (loginName, password) => {
    const { userKey, loginKey, strictKey } = getAuthKeys()
    const cleanLogin = String(loginName || '').trim().toLowerCase()
    const email = cleanLogin.includes('@') ? cleanLogin : `${cleanLogin}@centrum.local`

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (authError || !authData?.session) {
        return { success: false, error: 'Невірний логін або пароль' }
      }

      const { data: profile, error: profileError } = await supabase.rpc('rpc_current_user_profile')
      if (profileError || !profile) {
        await supabase.auth.signOut()
        return { success: false, error: 'Профіль користувача не прив’язаний до захищеної сесії' }
      }

      const cleanUser = { ...profile, last_seen: new Date().toISOString() }
      localStorage.setItem(loginKey, cleanUser.login)
      localStorage.setItem(userKey, JSON.stringify(cleanUser))
      localStorage.setItem(strictKey, 'true')
      localStorage.removeItem('BACKEND_TOKEN')
      localStorage.removeItem('BACKEND_TOKEN_STAGING')
      if (setSessionLoading) setSessionLoading(false)
      setCurrentUser(cleanUser)
      sentryLogger.setUserContext(cleanUser)
      Promise.resolve(supabase.rpc('rpc_touch_user_presence', { p_user_id: cleanUser.id })).catch(() => {})
      if (setSystemUsers) {
        setSystemUsers(prev => prev.map(u => u.id === cleanUser.id ? cleanUser : u))
      }
      return { success: true, user: cleanUser }
    } catch (authError) {
      console.warn('[useAuth] Захищений вхід не виконано:', authError?.message || authError)
      return { success: false, error: 'Помилка підключення до сервера авторизації. Спробуйте пізніше.' }
    }
  }

  const logout = () => {
    const { userKey, loginKey, strictKey } = getAuthKeys()
    sentryLogger.setUserContext(null)
    supabase.auth.signOut().catch(() => {})
    localStorage.removeItem(loginKey)
    localStorage.removeItem('BACKEND_TOKEN')
    localStorage.removeItem('BACKEND_TOKEN_STAGING')
    localStorage.removeItem(userKey)
    localStorage.removeItem(strictKey)
    if (clearAllData) {
      clearAllData()
    } else {
      setCurrentUser(null)
    }
  }

  const upsertUser = async (userData) => {
    const payload = { ...userData }
    if (!payload.id) delete payload.id
    if (payload.token) delete payload.token
    
    // Avoid overwriting password if it is unchanged
    if (!payload.password || payload.password === '••••••••') {
      delete payload.password
    }

    // ── 1. Спроба виконати через атомарний Enterprise RPC ──
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_admin_upsert_user', {
        p_user_payload: payload
      })

      if (!rpcErr && rpcRes?.success && rpcRes?.data) {
        const result = rpcRes.data
        setSystemUsers(prev => {
          const idx = prev.findIndex(u => u.id === result.id)
          if (idx >= 0) { const next = [...prev]; next[idx] = result; return next }
          return [...prev, result]
        })
        if (currentUser && currentUser.id === result.id) {
          setCurrentUser(result)
          sentryLogger.setUserContext(result)
        }
        return { data: result, error: null }
      }

      if (rpcRes && !rpcRes.success && rpcRes.error) {
        return { data: null, error: new Error(rpcRes.error) }
      }
      return { data: null, error: rpcErr || new Error('Захищена операція не виконана') }
    } catch (e) {
      return { data: null, error: e }
    }
  }

  const deleteUser = async (id) => {
    // ── 1. Спроба виконати через атомарний Enterprise RPC ──
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_admin_delete_user', {
        p_target_user_id: id
      })

      if (!rpcErr && rpcRes?.success) {
        setSystemUsers(prev => prev.filter(u => u.id !== id))
        return { error: null }
      }

      if (rpcRes && !rpcRes.success && rpcRes.error) {
        return { error: new Error(rpcRes.error) }
      }
      return { error: rpcErr || new Error('Захищена операція не виконана') }
    } catch (e) {
      return { error: e }
    }
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
