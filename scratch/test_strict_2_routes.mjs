import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testStrict2Routes() {
  const { data: cards } = await supabase.from('work_cards').select('id, task_id, status, operation, quantity, used_in_shop2_qty, nomenclature_id, order_id, card_info, is_rework')
  const { data: tasks } = await supabase.from('tasks').select('id, step')

  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  let route1_2_received = 0
  let route1_2_used = 0
  let route1_2_available = 0
  let shop2ActiveQty = 0

  cards?.forEach(c => {
    const isShop2Card = shop2TaskIds.has(String(c.task_id)) || c.card_info?.includes('[SHOP:2]')
    if (!isShop2Card) {
      // Route 1 (Shop 1 Cutting/Sorting) & Route 2 (VKYA return)
      if (c.status === 'at-shop2-buffer' || c.is_rework || c.card_info?.includes('[REDO]')) {
        const qty = Number(c.quantity || 0)
        const used = Number(c.used_in_shop2_qty || 0)
        const avail = Math.max(0, qty - used)

        route1_2_received += qty
        route1_2_used += used
        route1_2_available += avail
      }
    } else {
      if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer'].includes(c.status)) {
        shop2ActiveQty += Number(c.quantity || 0)
      }
    }
  })

  console.log('=== STRICT 2-ROUTES SHOP 2 BUFFER MATH ===')
  console.log(`Route 1 & 2 Total Received in Buffer: ${route1_2_received} шт`)
  console.log(`Already used for Shop 2 Cards (used_in_shop2_qty): ${route1_2_used} шт`)
  console.log(`Available Remaining Buffer: ${route1_2_available} шт`)
  console.log(`Active Cards running in Shop 2: ${shop2ActiveQty} шт`)
}

testStrict2Routes().catch(console.error)
