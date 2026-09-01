import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testAllShop2CardInfoPatterns() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('id, step, name, order_id')

  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    const name = String(t.name || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
        name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  let activeShop2Count = 0
  let activeShop2Qty = 0

  cards?.forEach(c => {
    const isShop2Card = shop2TaskIds.has(String(c.task_id)) ||
                        c.card_info?.includes('[SHOP:2]') ||
                        c.card_info?.includes('[ЦЕХ №2]') ||
                        ['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Пакування'].includes(c.operation)

    if (isShop2Card) {
      if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer', 'at-buffer'].includes(c.status)) {
        activeShop2Count++
        activeShop2Qty += Number(c.quantity || 0)
        console.log(`Active Card: ${c.id} | Op: ${c.operation} | Status: ${c.status} | Qty: ${c.quantity} | Info: ${c.card_info}`)
      }
    }
  })

  console.log(`\nTOTAL ACTIVE SHOP 2 CARDS IN DB: ${activeShop2Count} cards`)
  console.log(`TOTAL ACTIVE SHOP 2 QUANTITY: ${activeShop2Qty} шт`)
}

testAllShop2CardInfoPatterns().catch(console.error)
