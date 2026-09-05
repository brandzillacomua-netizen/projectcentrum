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
  
  console.log('Order ID:', order.id, 'Num:', order.order_num, 'Status:', order.status)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', order.id)

  console.log('\n--- TASKS IN ORDER ---')
  for (const t of tasks) {
    console.log(JSON.stringify({
      id: t.id,
      step: t.step,
      operation: t.operation,
      machine: t.machine,
      machine_id: t.machine_id,
      status: t.status,
      is_ready: t.is_ready,
      quantity: t.quantity,
      nomenclature_id: t.nomenclature_id,
      notes: t.notes,
      plan_snapshot: t.plan_snapshot
    }, null, 2))
  }

  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('order_id', order.id)

  console.log(`\n--- ALL CARDS IN ORDER (${cards.length}) ---`)
  // Group cards by task_id and status
  const cardGroup = {}
  for (const c of cards) {
    const key = `Task: ${c.task_id} | Op: ${c.operation} | Status: ${c.status} | Machine: ${c.machine}`
    cardGroup[key] = (cardGroup[key] || 0) + 1
  }
  console.log('Cards grouped:', cardGroup)

  // Sample card details
  cards.slice(0, 3).forEach((c, idx) => {
    console.log(`\nSample Card #${idx + 1}:`, JSON.stringify(c, null, 2))
  })

  // Check nomenclatures for these cards
  const nomIds = [...new Set(cards.map(c => c.nomenclature_id))]
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name, type, nomenclature_code, material_type, units_per_sheet')
    .in('id', nomIds)
  console.log('\n--- NOMENCLATURES ---', noms)

  // Check material requests for order
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .eq('order_id', order.id)
  console.log('\n--- MATERIAL REQUESTS ---')
  for (const r of reqs) {
    console.log(`Req: ${r.id} | task_id: ${r.task_id} | card_id: ${r.card_id} | status: ${r.status} | qty: ${r.quantity} | nom_id: ${r.nomenclature_id} | details: ${r.details}`)
  }

  // Check packaging_boxes or boxes for this order or cards
  const { data: boxes } = await supabase
    .from('packaging_boxes')
    .select('*')
    .eq('order_id', order.id)
  console.log('\n--- PACKAGING BOXES ---', boxes?.length)
}

main().catch(console.error)
