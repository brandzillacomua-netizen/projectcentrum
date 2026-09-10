import { createClient } from '@supabase/supabase-js'
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { error: authError } = await client.auth.signInWithPassword({ email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD })
if (authError) throw new Error(`Audit login failed: ${authError.message}`)
const { data: inventory, error } = await client.from('inventory').select('id,name,nomenclature_id,warehouse,total_qty,reserved_qty').eq('name', 'Фреза 6мм твердосплавна HRC55 (Тайвань)')
if (error) throw error
console.log(JSON.stringify({ inventory }))
for (const row of inventory.filter(i => i.warehouse === 'operational' || !i.warehouse)) {
  const { data: requests, count, error: reqError } = await client.from('material_requests').select('id,status,details,created_at,order_id,task_id,quantity,nomenclature_id,inventory_id', { count: 'exact' }).eq('inventory_id', row.id).order('created_at', { ascending: false }).limit(30)
  if (reqError) throw reqError
  console.log(JSON.stringify({ inventory_id: row.id, count, requests }))
  const ids = [...new Set(requests.map(r => r.order_id).filter(Boolean))]
  if (ids.length) {
    const { data: orders, error: orderError } = await client.from('orders').select('id,order_num,status').in('id', ids)
    if (orderError) throw orderError
    console.log(JSON.stringify({ orders }))
  }
}
