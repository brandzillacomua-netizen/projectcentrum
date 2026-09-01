import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))

  console.log(`Total work_cards: ${cards.length}`)

  const shop2Ops = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп']
  
  const shop2Cards = cards.filter(c => {
    const op = String(c.operation || '').toLowerCase()
    return shop2Ops.some(o => op.includes(o))
  })

  console.log(`Total Shop 2 cards: ${shop2Cards.length}`)

  const completedShop2 = shop2Cards.filter(c => c.status === 'completed')
  console.log(`Completed Shop 2 cards: ${completedShop2.length}`)
  
  completedShop2.forEach(c => {
    const nom = nomMap.get(c.nomenclature_id)
    console.log(`  Card ${c.id.slice(-8)} | nom: ${nom?.name} | op: ${c.operation} | qty: ${c.quantity} | order_id: ${c.order_id?.slice(-8)}`)
  })
}

run().catch(console.error)
