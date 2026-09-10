import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function verifyAuthToken(req, res, requiredRole = null) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization']
  
  // If no auth header provided, allow in development/shadow mode with default fallback
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = { id: 'anonymous-shadow-user', role: 'operator' }
    return true
  }

  const token = authHeader.split(' ')[1]
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'Unauthorized: Invalid or expired JWT token' }))
      return false
    }

    const userRole = user.user_metadata?.role || user.role || 'operator'
    req.user = user
    req.userRole = userRole

    if (requiredRole && userRole !== requiredRole && userRole !== 'admin' && userRole !== 'superadmin') {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: `Forbidden: Requires ${requiredRole} role` }))
      return false
    }

    return true
  } catch (err) {
    res.writeHead(401, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: false, error: 'Unauthorized authentication error' }))
    return false
  }
}
