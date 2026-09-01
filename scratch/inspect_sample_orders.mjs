import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: tasks } = await supabase.from('tasks').select('*').limit(10)
  const { data: orders } = await supabase.from('orders').select('*, order_items(*)').limit(10)
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))

  console.log('Sample orders with order_items:')
  orders.forEach(o => {
    const itemsInfo = (o.order_items || []).map(it => {
      const nom = nomMap.get(it.nomenclature_id)
      return `${nom?.name || 'Nom ' + it.nomenclature_id} (${it.quantity} шт)`
    }).join(', ')
    const mainNom = nomMap.get(o.nomenclature_id)?.name
    console.log(`Order ${o.order_num}: mainNom=${mainNom}, items=[${itemsInfo}], customer=${o.customer}`)
  })
}

run().catch(console.error)
