import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
})

async function main() {
  console.log('--- SEARCHING ORDERS ---')
  const { data: orders, error: oErr } = await supabase
    .from('orders')
    .select('*')
    .ilike('order_num', '%260905-1%')
  
  if (oErr) console.error('Orders err:', oErr)
  console.log('Orders found:', orders?.length)
  if (orders) {
    orders.forEach(o => console.log('Order:', o.id, o.order_num, o.status, o.created_at))
  }

  // Also check if there are other orders created around 2026-09-05 or order_num containing 260905
  const { data: anyTodayOrders } = await supabase
    .from('orders')
    .select('id, order_num, status, created_at')
    .ilike('order_num', '%260905%')
  console.log('Any 260905 orders:', anyTodayOrders)

  const targetOrder = orders && orders.length > 0 ? orders[0] : (anyTodayOrders && anyTodayOrders.length > 0 ? anyTodayOrders[0] : null)
  if (!targetOrder) {
    console.log('No order found!')
    return
  }

  console.log('\n--- TARGET ORDER DETAILS ---')
  console.log(JSON.stringify(targetOrder, null, 2))

  console.log('\n--- TASKS FOR ORDER ---')
  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', targetOrder.id)
  
  if (tErr) console.error('Tasks err:', tErr)
  console.log('Tasks count:', tasks?.length)
  tasks?.forEach(t => {
    console.log(`Task: ${t.id} | Step: ${t.step} | Status: ${t.status} | Nom: ${t.nomenclature_id} | Qty: ${t.quantity} | is_ready: ${t.is_ready} | machine: ${t.machine_id}`)
  })

  console.log('\n--- WORK CARDS FOR ORDER ---')
  const { data: cards, error: cErr } = await supabase
    .from('work_cards')
    .select('*')
    .eq('order_id', targetOrder.id)
  
  if (cErr) console.error('Cards err:', cErr)
  console.log('Cards count:', cards?.length)
  cards?.forEach(c => {
    console.log(`Card: ${c.id} | num: ${c.card_number} | full_num: ${c.full_card_number} | status: ${c.status} | task_id: ${c.task_id} | qty: ${c.quantity} | stage: ${c.stage} | current_stage: ${c.current_stage} | is_completed: ${c.is_completed} | barcode: ${c.barcode || c.code}`)
  })
  if (cards && cards.length > 0) {
    console.log('First card full object:', JSON.stringify(cards[0], null, 2))
  }
}

main().catch(console.error)
