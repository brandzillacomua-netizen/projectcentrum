import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function investigateDiscrepancy() {
  console.log('=== 1. WORK CARDS BY STATUS ===')
  const { data: cards } = await supabase.from('work_cards').select('id, task_id, status, operation, quantity, card_info')
  const { data: tasks } = await supabase.from('tasks').select('id, step, name, order_id')

  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  const statusMap = {}
  let totalCardsQty = 0
  let atShop2BufferQty = 0
  let completedShop1Qty = 0
  let shop2ActiveCardsQty = 0

  cards?.forEach(c => {
    const st = c.status || 'unknown'
    statusMap[st] = (statusMap[st] || 0) + Number(c.quantity || 0)
    totalCardsQty += Number(c.quantity || 0)

    const isShop2Card = shop2TaskIds.has(String(c.task_id)) || c.card_info?.includes('[SHOP:2]')
    if (!isShop2Card) {
      if (c.status === 'at-shop2-buffer') atShop2BufferQty += Number(c.quantity || 0)
      if (c.status === 'completed') completedShop1Qty += Number(c.quantity || 0)
    } else {
      if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer'].includes(c.status)) {
        shop2ActiveCardsQty += Number(c.quantity || 0)
      }
    }
  })

  console.log('Cards Quantity breakdown by status:', statusMap)
  console.log(`Shop 1 cards with status='at-shop2-buffer': ${atShop2BufferQty}`)
  console.log(`Shop 1 cards with status='completed': ${completedShop1Qty}`)
  console.log(`Shop 2 active cards (new/in-progress/etc.): ${shop2ActiveCardsQty}`)

  console.log('\n=== 2. WMS INVENTORY TABLE ===')
  const { data: inv } = await supabase.from('inventory').select('*')
  const invMap = {}
  inv?.forEach(i => {
    invMap[i.type] = (invMap[i.type] || 0) + Number(i.total_qty || 0)
  })
  console.log('Inventory by type:', invMap)
}

investigateDiscrepancy().catch(console.error)
