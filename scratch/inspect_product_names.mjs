import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectProductNames() {
  const { data: orders } = await supabase.from('orders').select('*').limit(10)
  console.log('=== SAMPLE ORDERS ===')
  orders?.forEach(o => {
    console.log(`Order: ${o.order_num} | name: ${o.name} | product: ${o.product_name || o.product || 'N/A'}`)
    console.log('  keys:', Object.keys(o))
  })

  const { data: tasks } = await supabase.from('tasks').select('*').limit(10)
  console.log('\n=== SAMPLE TASKS ===')
  tasks?.forEach(t => {
    console.log(`Task: ${t.id} | name: ${t.name} | order_id: ${t.order_id}`)
  })
}

inspectProductNames().catch(console.error)
