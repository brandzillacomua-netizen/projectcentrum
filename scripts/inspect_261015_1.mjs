import { createClient } from '@supabase/supabase-js'

const url = 'https://hurzutjytlcvtbvihnry.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(url, key)

async function main() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' })

  console.log('=== FINDING ORDER 261015-1 ===')
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_number, client')
    .ilike('order_number', '%261015-1%')
  console.log('Orders matching 261015-1:', orders)

  let orderId = orders?.[0]?.id

  // Also check tasks if order not found by order_number
  if (!orderId) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, task_number, name, client, order_id')
      .ilike('task_number', '%261015-1%')
    console.log('Tasks matching 261015-1:', tasks)
    orderId = tasks?.[0]?.order_id
  }

  console.log('Target order_id:', orderId)

  // Check inventory for F415-ІП27
  const { data: inv } = await supabase
    .from('inventory')
    .select('id, name, nomenclature_id, warehouse, type, total_qty, reserved_qty')
    .ilike('name', '%F415-ІП27%')

  console.log('\n=== INVENTORY FOR F415-ІП27 ===')
  inv?.forEach(i => console.log(`${i.name}: wh=${i.warehouse}, type=${i.type}, total=${i.total_qty}, res=${i.reserved_qty}, nom=${i.nomenclature_id}, id=${i.id}`))

  // Check material requests for order or for these nomenclatures
  const nomIds = inv?.map(i => i.nomenclature_id).filter(Boolean) || []
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .or(`order_id.eq.${orderId},details.ilike.%261015-1%`)

  console.log('\n=== MATERIAL REQUESTS FOR 261015-1 ===')
  reqs?.forEach(r => console.log(`Req ${r.id}: nom=${r.nomenclature_id}, qty=${r.quantity}, status=${r.status}, cat=${r.category}, wh=${r.target_warehouse}, details="${r.details}"`))

  // Also check all requests for these nomIds that are reserving stock
  const { data: allNomReqs } = await supabase
    .from('material_requests')
    .select('id, order_id, quantity, status, details, nomenclature_id')
    .in('nomenclature_id', nomIds)
    .in('status', ['issued', 'pending', 'processing'])

  console.log('\n=== ACTIVE REQUESTS FOR THESE NOMENCLATURES ===')
  allNomReqs?.forEach(r => console.log(`Nom ${r.nomenclature_id}: qty=${r.quantity}, status=${r.status}, order=${r.order_id}, details="${r.details}"`))
}

main().catch(console.error)

