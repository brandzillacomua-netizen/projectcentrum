import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function auditActiveShop2Cards() {
  const { data: tasks } = await supabase.from('tasks').select('id, step, name, order_id')
  const { data: orders } = await supabase.from('orders').select('id, order_num, customer')
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, nomenclature_code')
  const { data: cards } = await supabase.from('work_cards').select('*')

  const nomMap = new Map(noms?.map(n => [n.id, n]) || [])
  const orderMap = new Map(orders?.map(o => [o.id, o]) || [])

  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  console.log('=== AUDIT OF SHOP 2 CARDS IN DATABASE ===')
  
  const shop2Cards = cards?.filter(c => {
    return shop2TaskIds.has(String(c.task_id)) || c.card_info?.includes('[SHOP:2]') || c.card_info?.includes('[ЦЕХ №2]')
  }) || []

  console.log(`Total Shop 2 Cards found in DB: ${shop2Cards.length}`)

  const statusBreakdown = {}
  let activeCardsSumQty = 0

  shop2Cards.forEach(c => {
    const st = c.status || 'unknown'
    statusBreakdown[st] = (statusBreakdown[st] || 0) + 1
    if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer'].includes(st)) {
      activeCardsSumQty += Number(c.quantity || 0)
    }
  })

  console.log('Shop 2 Cards count by status:', statusBreakdown)
  console.log(`Sum of quantities in active Shop 2 cards: ${activeCardsSumQty} шт\n`)

  console.log('--- SAMPLE ACTIVE SHOP 2 CARDS (FIRST 15) ---')
  const activeCards = shop2Cards.filter(c => ['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer'].includes(c.status))
  
  activeCards.slice(0, 15).forEach(c => {
    const nom = nomMap.get(c.nomenclature_id)
    const ord = orderMap.get(c.order_id)
    console.log(`ID: ${c.id}`)
    console.log(`  Order: ${ord?.order_num || c.order_id || 'N/A'}`)
    console.log(`  Part: ${nom?.name || c.name || 'N/A'} [${nom?.nomenclature_code || ''}]`)
    console.log(`  Operation: ${c.operation} | Status: ${c.status} | Qty: ${c.quantity} шт`)
    console.log(`  Card Info: ${c.card_info || '—'}`)
    console.log(`  Created At: ${c.created_at}`)
    console.log('--------------------------------------------------')
  })
}

auditActiveShop2Cards().catch(console.error)
