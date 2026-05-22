import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: orders, error: errOrders } = await supabase
    .from('orders')
    .select('*')
    .eq('order_num', '2222')
  
  if (errOrders) {
    console.error('Error orders:', errOrders)
    return
  }
  
  console.log('Order 2222 details:')
  console.log(JSON.stringify(orders, null, 2))
  
  if (!orders || orders.length === 0) {
    console.log('No order found with num 2222')
    return
  }
  
  const orderId = orders[0].id
  
  const { data: orderItems, error: errItems } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    
  if (errItems) {
    console.error('Error items:', errItems)
    return
  }
  
  console.log('\nOrder Items:')
  console.log(JSON.stringify(orderItems, null, 2))
  
  const nomIds = orderItems.map(it => it.nomenclature_id)
  
  const { data: noms, error: errNoms } = await supabase
    .from('nomenclatures')
    .select('*')
    .in('id', nomIds)
    
  if (errNoms) {
    console.error('Error nomenclatures:', errNoms)
    return
  }
  
  console.log('\nNomenclatures for order items:')
  noms.forEach(n => {
    console.log(`- ${n.name} (id: ${n.id}, type: ${n.type})`)
  })
  
  // Now let's fetch BOM items where parent_id is one of these nomIds
  const { data: boms, error: errBoms } = await supabase
    .from('bom_items')
    .select('*')
    
  if (errBoms) {
    console.error('Error BOM:', errBoms)
    return
  }
  
  console.log('\nBOM Items for these Nomenclatures:')
  const childNomIds = new Set()
  boms.filter(b => nomIds.includes(b.parent_id)).forEach(b => {
    const parentNom = noms.find(n => n.id === b.parent_id)
    childNomIds.add(b.child_id)
    console.log(`Parent "${parentNom?.name}" (id: ${b.parent_id}) -> Child ID: ${b.child_id}, qty: ${b.quantity_per_parent}`)
  })
  
  if (childNomIds.size > 0) {
    const { data: childNoms } = await supabase
      .from('nomenclatures')
      .select('*')
      .in('id', Array.from(childNomIds))
      
    console.log('\nChild Nomenclatures:')
    childNoms?.forEach(n => {
      console.log(`- ${n.name} (id: ${n.id}, type: ${n.type}, code: ${n.nomenclature_code}, material: ${n.material_type}, units_per_sheet: ${n.units_per_sheet})`)
    })
  }
}

run()
