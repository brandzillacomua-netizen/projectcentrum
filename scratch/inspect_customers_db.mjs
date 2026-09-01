import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const envText = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8')
const envVars = {}
envText.split('\n').forEach(line => {
  const [k, v] = line.split('=')
  if (k && v) envVars[k.trim()] = v.trim().replace(/^["']|["']$/g, '')
})

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY)

async function inspectData() {
  const { data: customers, error: errCust } = await supabase.from('customers').select('*')
  console.log('Customers in DB count:', customers?.length)
  console.log('Customers with numeric/order-like names in DB:', customers?.filter(c => /^\d[\d-]*$/.test((c.name||'').trim())))

  const { data: orders, error: errOrd } = await supabase.from('orders').select('id, order_number, customer, client_name')
  const numericCustOrders = orders?.filter(o => {
    const c = (o.customer || o.client_name || '').trim()
    return /^\d[\d-]*$/.test(c)
  })
  console.log('Orders count with numeric/order_number customer:', numericCustOrders?.length)
  console.log('Sample numeric customer orders:', numericCustOrders?.slice(0, 10))
}

inspectData().catch(console.error)
