import { createClient } from '@supabase/supabase-js'

const url = 'https://hurzutjytlcvtbvihnry.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(url, key)

async function main() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' })

  // 1. Check order 281022-1 requests
  const { data: order281022 } = await supabase
    .from('orders')
    .select('id, order_number, client')
    .ilike('order_number', '%281022-1%')
  console.log('Order 281022-1:', order281022)

  if (order281022 && order281022.length > 0) {
    const orderId = order281022[0].id
    const { data: requests } = await supabase
      .from('material_requests')
      .select('*')
      .eq('order_id', orderId)
    console.log('Requests for 281022-1:', requests?.map(r => ({
      id: r.id,
      name: r.nomenclature_name,
      nom_id: r.nomenclature_id,
      qty: r.quantity,
      status: r.status,
      type: r.type,
      details: r.details
    })))
  }

  // 2. Check inventory for RND-280
  const { data: inv280 } = await supabase
    .from('inventory')
    .select('id, name, nomenclature_id, warehouse, type, total_qty, reserved_qty, created_at')
    .ilike('name', '%RND-280%')
  console.log('Inventory for RND-280:', inv280)

  // 3. Check nomenclatures for RND-280
  const { data: nom280 } = await supabase
    .from('nomenclatures')
    .select('id, name, type')
    .ilike('name', '%RND-280%')
  console.log('Nomenclatures for RND-280:', nom280)

  // 4. Check inventory with warehouse = 'sgp' where nomenclature_id is null
  const { data: sgpNullNom } = await supabase
    .from('inventory')
    .select('id, name, warehouse, type, total_qty, reserved_qty')
    .eq('warehouse', 'sgp')
    .is('nomenclature_id', null)
  console.log('SGP inventory with null nomenclature_id:', sgpNullNom)
}

main().catch(console.error)
