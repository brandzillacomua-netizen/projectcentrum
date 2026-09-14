export const PROD_SESSION_KEYS = Object.freeze({
  user: 'MES_SESSION_USER',
  login: 'MES_SESSION_LOGIN',
  strict: 'MES_SESSION_STRICT',
  legacyToken: 'BACKEND_TOKEN'
})

export function clearProductionSessionCache(storage = localStorage) {
  Object.values(PROD_SESSION_KEYS).forEach(key => storage.removeItem(key))
}

function cacheProductionUser(user, storage) {
  storage.setItem(PROD_SESSION_KEYS.user, JSON.stringify(user))
  storage.setItem(PROD_SESSION_KEYS.login, String(user.login || ''))
  storage.setItem(PROD_SESSION_KEYS.strict, 'true')
  storage.removeItem(PROD_SESSION_KEYS.legacyToken)
}

export async function restoreProductionSession(client, storage = localStorage) {
  const { data, error } = await client.auth.getSession()
  const session = data?.session

  if (error || !session?.access_token || !session?.user?.id) {
    clearProductionSessionCache(storage)
    return null
  }

  // Validate the JWT against PostgreSQL and reload current authorization data.
  // localStorage is only a cache; it is never an authentication authority.
  const { data: profile, error: profileError } = await client.rpc('rpc_current_user_profile')
  if (profileError || !profile?.id) {
    clearProductionSessionCache(storage)
    await client.auth.signOut().catch(() => {})
    return null
  }

  cacheProductionUser(profile, storage)
  return profile
}
