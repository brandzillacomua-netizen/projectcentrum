import { supabase } from '../supabase'
import { apiService } from '../services/apiDispatcher'

/**
 * Auth & User Management hooks
 * Returns: { login, logout, upsertUser, deleteUser, searchCustomers }
 */
export function createAuthActions({ currentUser, setCurrentUser, setSystemUsers, fetchData }) {

  const login = async (loginName, password) => {
    const backendRes = await apiService.submitLogin(loginName, password)

    const { data } = await supabase
      .from('system_users')
      .select('*')
      .eq('login', loginName)

    let user = (data && data.length > 0) ? data[0] : null
    const token = backendRes?.token || backendRes?.accessToken || backendRes?.data?.token
    const isSupabaseAuth = user && user.password === password
    const isBackendAuth = !!token

    if (isSupabaseAuth || isBackendAuth) {
      let finalUser = user
      if (!user && isBackendAuth) {
        const newUser = {
          login: loginName,
          password: password,
          first_name: 'Зовнішній',
          last_name: 'Користувач',
          position: 'Працівник',
          access_rights: { operator: true, manager: true }
        }
        const { data: created } = await upsertUser(newUser)
        finalUser = created
      }
      const userWithToken = { ...finalUser, token }
      setCurrentUser(userWithToken)
      localStorage.setItem('MES_SESSION_LOGIN', finalUser.login)
      return { success: true, user: userWithToken }
    }
    return { success: false, error: 'Невірний логін або пароль' }
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('MES_SESSION_LOGIN')
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
