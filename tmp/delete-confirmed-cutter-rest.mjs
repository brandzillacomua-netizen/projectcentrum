import { createClient } from '@supabase/supabase-js'
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { error: authError } = await client.auth.signInWithPassword({ email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD })
if (authError) throw authError
const inventoryId = '9d8271f8-ebea-4a38-880c-50a5674afaa9'
const requestId = 'a5c8a7aa-0d81-46a5-8a3e-3b6c5ae9c09f'
const { data: refs, error: refsError } = await client.from('material_requests').select('id,status').eq('inventory_id', inventoryId)
if (refsError) throw refsError
if (refs.length !== 1 || refs[0].id !== requestId || refs[0].status !== 'cancelled') throw new Error('Dependencies changed')
const { data: stock, error: stockError } = await client.from('inventory').select('id,name,total_qty,reserved_qty,warehouse').eq('id', inventoryId).single()
if (stockError) throw stockError
if (stock.name !== 'Фреза 6мм твердосплавна HRC55 (Тайвань)' || stock.warehouse !== 'operational' || Number(stock.total_qty) !== 999 || Number(stock.reserved_qty) !== 0) throw new Error('Inventory changed')
const unlink = await client.from('material_requests').update({ inventory_id: null }).eq('id', requestId).eq('inventory_id', inventoryId).eq('status', 'cancelled').select('id')
if (unlink.error || unlink.data?.length !== 1) throw new Error(`Unlink failed: ${unlink.error?.message || 'request changed'}`)
const deleted = await client.from('inventory').delete().eq('id', inventoryId).eq('warehouse', 'operational').eq('total_qty', 999).eq('reserved_qty', 0).select('id')
if (deleted.error || deleted.data?.length !== 1) {
  const stockExists = await client.from('inventory').select('id').eq('id', inventoryId).maybeSingle()
  if (stockExists.error) throw new Error('Deletion outcome uncertain; verification required')
  if (stockExists.data) {
    const restored = await client.from('material_requests').update({ inventory_id: inventoryId }).eq('id', requestId).is('inventory_id', null).eq('status', 'cancelled').select('id')
    if (restored.error || restored.data?.length !== 1) throw new Error('Deletion failed and reference restoration needs attention')
    throw new Error(`Deletion failed; original reference restored: ${deleted.error?.message || 'inventory changed'}`)
  }
}
const [stockCheck, requestCheck] = await Promise.all([
  client.from('inventory').select('id').eq('id', inventoryId),
  client.from('material_requests').select('id,status,inventory_id,nomenclature_id,details,quantity').eq('id', requestId).single()
])
if (stockCheck.error || requestCheck.error || stockCheck.data.length || requestCheck.data.inventory_id !== null || requestCheck.data.status !== 'cancelled') throw new Error('Verification needs attention')
console.log(JSON.stringify({ deletedInventoryId: inventoryId, preservedRequest: requestCheck.data }))
