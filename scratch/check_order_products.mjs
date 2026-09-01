import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkOrderProducts() {
  const { data: orders } = await supabase.from('orders').select('id, order_num, nomenclature_id, customer').limit(10)
  const nomIds = orders?.map(o => o.nomenclature_id).filter(Boolean) || []
  
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, nomenclature_code').in('id', nomIds)
  const nomMap = new Map(noms?.map(n => [n.id, n]) || [])

  console.log('=== ORDERS & FINISHED PRODUCTS ===')
  orders?.forEach(o => {
    const nom = nomMap.get(o.nomenclature_id)
    console.log(`Order ${o.order_num}: Product = "${nom?.name || 'Нейтральний виробу'}" (${nom?.nomenclature_code || 'no code'}) | Customer: ${o.customer || '—'}`)
  })
}

checkOrderProducts().catch(console.error)
