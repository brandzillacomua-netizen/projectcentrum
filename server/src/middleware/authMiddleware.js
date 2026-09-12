import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function verifyAuthToken(req, res, requiredRole = null) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization']
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'Unauthorized: Bearer token required' }))
    return false
  }

  const token = authHeader.split(' ')[1]
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired JWT token' }))
      return false
    }

    const scopedClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false }
    })
    const { data: profile, error: profileError } = await scopedClient.rpc('rpc_current_user_profile')
    if (profileError || !profile) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'Forbidden: MES profile is not linked' }))
      return false
    }

    const rights = Array.isArray(profile.access_rights)
      ? profile.access_rights
      : Object.entries(profile.access_rights || {}).filter(([, enabled]) => enabled === true).map(([right]) => right)
    req.user = { ...user, mesProfile: profile }
    req.userRole = rights

    if (requiredRole && !rights.includes(requiredRole) && !rights.includes('admin') && !rights.includes('director')) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: `Forbidden: Requires ${requiredRole} role` }))
      return false
    }

    return true
  } catch {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'Unauthorized authentication error' }))
    return false
  }
}
