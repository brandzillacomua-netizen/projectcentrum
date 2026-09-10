import { createClient } from '@supabase/supabase-js'
const client = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { error } = await client.auth.signInWithPassword({ email: process.env.AUDIT_EMAIL, password: process.env.AUDIT_PASSWORD })
if (error) throw error
const orders = await client.from('orders').select('id,order_num').eq('order_num','260825-1')
if (orders.error) throw orders.error
for (const order of orders.data) {
 const result = await client.from('material_requests').select('id,status,details,category,target_warehouse,nomenclature_id,task_id').eq('order_id',order.id).in('status',['pending','issued'])
 if (result.error) throw result.error
 console.log(JSON.stringify({order,requests:result.data}))
}
