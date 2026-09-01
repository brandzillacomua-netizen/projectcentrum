import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testTrueShop2Buffer() {
  const { data: cards } = await supabase.from('work_cards').select('id, task_id, status, operation, quantity, nomenclature_id, order_id, card_info')
  const { data: inv } = await supabase.from('inventory').select('*').in('type', ['semi_shop2', 'bz_shop2'])

  const { data: tasks } = await supabase.from('tasks').select('id, step')
  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  let shop1BufferCardsQty = 0
  let shop2ActiveCardsQty = 0
  let shop2CompletedCardsQty = 0

  cards?.forEach(c => {
    const isShop2Card = shop2TaskIds.has(String(c.task_id)) || c.card_info?.includes('[SHOP:2]')
    if (!isShop2Card) {
      if (c.status === 'at-shop2-buffer') {
        shop1BufferCardsQty += Number(c.quantity || 0)
      }
    } else {
      if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer'].includes(c.status)) {
        shop2ActiveCardsQty += Number(c.quantity || 0)
      } else if (c.status === 'completed') {
        shop2CompletedCardsQty += Number(c.quantity || 0)
      }
    }
  })

  let invQty = 0
  inv?.forEach(i => {
    invQty += Number(i.total_qty || 0)
  })

  console.log('=== TRUE SHOP 2 BUFFER ANALYSIS ===')
  console.log(`Cards at-shop2-buffer: ${shop1BufferCardsQty} шт`)
  console.log(`Inventory (semi_shop2 + bz_shop2): ${invQty} шт`)
  console.log(`Total Received in Shop 2 Buffer: ${shop1BufferCardsQty + invQty} шт`)
  console.log(`Active Shop 2 Cards (В роботі): ${shop2ActiveCardsQty} шт`)
  console.log(`Completed Shop 2 Cards (Завершено): ${shop2CompletedCardsQty} шт`)
  console.log(`Available Free Qty to launch: ${Math.max(0, shop1BufferCardsQty + invQty - shop2ActiveCardsQty - shop2CompletedCardsQty)} шт`)
}

testTrueShop2Buffer().catch(console.error)
