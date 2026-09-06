import { supabase } from '../supabase'
import { apiService } from '../services/apiDispatcher'
import { sentryLogger } from '../services/sentryLogger'

const USER_CACHE_KEY = 'MES_SESSION_USER'

/**
 * Auth & User Management hooks
 * Returns: { login, logout, upsertUser, deleteUser, searchCustomers }
 */
export function createAuthActions({ currentUser, setCurrentUser, setSystemUsers, clearAllData, setSessionLoading }) {

  const login = async (loginName, password) => {
    const cleanLogin = String(loginName || '').trim().toLowerCase()
    const email = cleanLogin.includes('@') ? cleanLogin : `${cleanLogin}@centrum.local`

    // ── Спроба 1: Офіційний Supabase Auth (випуск персонального JWT) ─────────
    try {
      console.log(`[useAuth] 🔑 Спроба входу для: "${cleanLogin}" (email: "${email}")...`)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (!authError && authData?.session) {
        const token = authData.session.access_token
        localStorage.setItem('BACKEND_TOKEN', token)
        localStorage.setItem('MES_SESSION_STRICT', 'true')
        console.log(`[useAuth] 🛡️ Supabase Auth JWT успішно отримано! (UID: ${authData.session.user?.id})`)

        const { data: profile, error: profErr } = await supabase
          .from('system_users')
          .select('id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar')
          .ilike('login', cleanLogin)
          .maybeSingle()

        if (profile) {
          const cleanUser = { ...profile, token }
          localStorage.setItem('MES_SESSION_LOGIN', cleanUser.login)
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cleanUser))
          if (setSessionLoading) setSessionLoading(false)
          setCurrentUser(cleanUser)
          sentryLogger.setUserContext(cleanUser)
          console.log(`[useAuth] ✅ Успішний вхід за персональним JWT для користувача: ${cleanUser.login} (${cleanUser.position})`)
          return { success: true, user: cleanUser }
        } else {
          console.warn('[useAuth] Профіль у system_users не знайдено, помилка:', profErr)
        }
      } else {
        console.warn(`[useAuth] ⚠️ Supabase Auth не спрацював (${authError?.message || 'Немає сесії'}). Переходимо на RPC fallback...`)
      }
    } catch (authErr) {
      console.warn('[useAuth] Supabase Auth signIn помилка, перехід на RPC:', authErr?.message || authErr)
    }

    // ── Спроба 2 (Graceful Fallback): Перевірка через RPC verify_user_password ──
    console.log(`[useAuth] 🔄 Виконуємо перевірку через RPC verify_user_password...`)
    const loginPromise = supabase
      .rpc('verify_user_password', { login_name: loginName, plain_password: password })
      .maybeSingle()

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), 8000)
    )

    let response;
    try {
      response = await Promise.race([loginPromise, timeoutPromise])
    } catch (err) {
      if (err.message === 'TIMEOUT') {
        return { success: false, error: 'Помилка підключення: Сервер не відповідає. Спробуйте увійти знову. Якщо проблема повторюється, перевірте, чи не призупинено проект в Supabase.' }
      }
      return { success: false, error: 'Помилка підключення до сервера бази даних. Спробуйте пізніше.' }
    }

    const { data, error: rpcError } = response

    if (rpcError || !data) {
      return { success: false, error: 'Невірний логін або пароль' }
    }

    // Cache BEFORE setCurrentUser so App.jsx gate never sees sessionLoading=true
    const cleanUser = { ...data }
    delete cleanUser.password
    localStorage.setItem('MES_SESSION_LOGIN', cleanUser.login)
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(cleanUser))
    // Immediately unblock the session gate — no spinner after login
    if (setSessionLoading) setSessionLoading(false)
    setCurrentUser(cleanUser)
    sentryLogger.setUserContext(cleanUser)
    console.log(`[useAuth] ℹ️ Успішний вхід через RPC verify_user_password (старий режим): ${cleanUser.login}`)

    return { success: true, user: cleanUser }
  }

  const logout = () => {
    sentryLogger.setUserContext(null)
    supabase.auth.signOut().catch(() => {})
    localStorage.removeItem('MES_SESSION_LOGIN')
    localStorage.removeItem('BACKEND_TOKEN')
    localStorage.removeItem(USER_CACHE_KEY)
    localStorage.removeItem('MES_SESSION_STRICT')
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

    const adminId = currentUser?.id || null

    // ── 1. Спроба виконати через атомарний Enterprise RPC ──
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_admin_upsert_user', {
        p_admin_id: adminId,
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

      // Якщо помилка валідації або прав — повертаємо без фолбеку
      if (rpcRes && !rpcRes.success && rpcRes.error) {
        return { data: null, error: new Error(rpcRes.error) }
      }
      if (rpcErr && rpcErr.code !== 'PGRST202') {
        return { data: null, error: rpcErr }
      }
    } catch (e) {
      console.warn('[useAuth] rpc_admin_upsert_user fallback:', e?.message || e)
    }

    // ── 2. Graceful Fallback для прямої таблиці ──
    let query = supabase.from('system_users')
    if (payload.id) {
      query = query.update(payload).eq('id', payload.id)
    } else {
      query = query.insert([payload])
    }

    const { data, error } = await query
      .select('id, login, first_name, last_name, position, access_rights, department, shift, notification_settings, avatar, last_seen, shift_calendar')
    
    const result = (data && data.length > 0) ? data[0] : null
    if (!error && result) {
      setSystemUsers(prev => {
        const idx = prev.findIndex(u => u.id === result.id)
        if (idx >= 0) { const next = [...prev]; next[idx] = result; return next }
        return [...prev, result]
      })
      if (currentUser && currentUser.id === result.id) {
        setCurrentUser(result)
        sentryLogger.setUserContext(result)
      }
    }
    return { data: result, error }
  }

  const deleteUser = async (id) => {
    const adminId = currentUser?.id || null

    // ── 1. Спроба виконати через атомарний Enterprise RPC ──
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_admin_delete_user', {
        p_admin_id: adminId,
        p_target_user_id: id
      })

      if (!rpcErr && rpcRes?.success) {
        setSystemUsers(prev => prev.filter(u => u.id !== id))
        return { error: null }
      }

      if (rpcRes && !rpcRes.success && rpcRes.error) {
        return { error: new Error(rpcRes.error) }
      }
      if (rpcErr && rpcErr.code !== 'PGRST202') {
        return { error: rpcErr }
      }
    } catch (e) {
      console.warn('[useAuth] rpc_admin_delete_user fallback:', e?.message || e)
    }

    // ── 2. Graceful Fallback ──
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
