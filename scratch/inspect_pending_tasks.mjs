import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*, order_items(*)')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')

  console.log(`Total tasks: ${tasks.length}, total orders: ${orders.length}`)

  // Pending tasks for director
  const pendingTasks = tasks.filter(t => 
    t.status === 'waiting' && 
    (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && 
    t.engineer_conf === true && 
    !t.director_conf
  )

  console.log(`Pending tasks for director: ${pendingTasks.length}`)
  pendingTasks.forEach(t => {
    const o = orders.find(ord => ord.id === t.order_id)
    console.log(`\nTask ID: ${t.id} | Step: ${t.step} | Planned sets: ${t.planned_sets}`)
    console.log(`Order: ${o?.order_num} | Customer: ${o?.customer} | nom_id: ${o?.nomenclature_id}`)
    console.log(`Order items:`, JSON.stringify(o?.order_items))
  })
}

run().catch(console.error)
