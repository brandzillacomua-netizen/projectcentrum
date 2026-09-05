import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
})

async function main() {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .ilike('order_num', '%260905-1%')
    .single()
  
  console.log('Order:', order)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', order.id)
  
  console.log('\n--- TASKS ---')
  for (const t of tasks) {
    console.log(`Task id: ${t.id}, step: ${t.step}, status: ${t.status}, machine: ${t.machine}, machine_id: ${t.machine_id}`)
  }

  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('order_id', order.id)

  console.log(`\n--- CARDS (${cards.length}) ---`)
  for (const c of cards) {
    console.log(`Card ${c.id.slice(0, 8)} | op: ${c.operation} | status: ${c.status} | card_info: ${c.card_info} | machine: ${c.machine} | machine_id: ${c.machine_id} | qty: ${c.quantity}`)
  }

  const { data: matReqs } = await supabase
    .from('material_requests')
    .select('*')
    .eq('order_id', order.id)
  
  console.log(`\n--- MATERIAL REQUESTS (${matReqs?.length}) ---`)
  for (const mr of matReqs || []) {
    console.log(`Req ${mr.id} | type: ${mr.type || mr.request_type} | status: ${mr.status} | item: ${mr.material_name || mr.item_name || mr.nomenclature_id} | qty: ${mr.quantity || mr.amount}`)
  }

  // Check cutter requests / purchase requests
  const { data: cutters } = await supabase
    .from('card_cutters')
    .select('*')
    .in('card_id', cards.map(c => c.id))
  
  console.log(`\n--- CARD CUTTERS (${cutters?.length}) ---`)
  cutters?.forEach(cc => console.log(cc))

  // Also check if there's cutter_requests or similar table
  const { data: purchaseReqs } = await supabase
    .from('purchase_requests')
    .select('*')
    .eq('order_id', order.id)
  console.log(`\n--- PURCHASE REQUESTS (${purchaseReqs?.length}) ---`, purchaseReqs)
}

main().catch(console.error)
