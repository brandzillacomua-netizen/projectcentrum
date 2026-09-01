import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testExactShop2BufferMath() {
  const { data: cards } = await supabase.from('work_cards').select('id, task_id, status, operation, quantity, used_in_shop2_qty, nomenclature_id, order_id, card_info')
  const { data: inv } = await supabase.from('inventory').select('*').in('type', ['semi_shop2', 'bz_shop2'])

  const { data: tasks } = await supabase.from('tasks').select('id, step')
  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  let rawBufferCardsQty = 0
  let usedInShop2Qty = 0
  let availableBufferCardsQty = 0
  let shop2ActiveCardsQty = 0

  cards?.forEach(c => {
    const isShop2Card = shop2TaskIds.has(String(c.task_id)) || c.card_info?.includes('[SHOP:2]')
    if (!isShop2Card) {
      if (c.status === 'at-shop2-buffer') {
        const qty = Number(c.quantity || 0)
        const used = Number(c.used_in_shop2_qty || 0)
        const avail = Math.max(0, qty - used)
        
        rawBufferCardsQty += qty
        usedInShop2Qty += used
        availableBufferCardsQty += avail
      }
    } else {
      if (['new', 'in-progress', 'waiting-cutters', 'waiting-materials', 'waiting-buffer'].includes(c.status)) {
        shop2ActiveCardsQty += Number(c.quantity || 0)
      }
    }
  })

  let invQty = 0
  inv?.forEach(i => {
    invQty += Number(i.total_qty || 0)
  })

  console.log('=== EXACT SYSTEM TRUTH FOR SHOP 2 BUFFER ===')
  console.log(`1. Raw Shop 1 cards in 'at-shop2-buffer': ${rawBufferCardsQty} шт`)
  console.log(`2. Already used in Shop 2 cards (used_in_shop2_qty): ${usedInShop2Qty} шт`)
  console.log(`3. Available remaining in buffer cards: ${availableBufferCardsQty} шт`)
  console.log(`4. Inventory (semi_shop2 + bz_shop2): ${invQty} шт`)
  console.log(`5. TOTAL FREE BUFFER AVAILABLE FOR NEW CARDS (3 + 4): ${availableBufferCardsQty + invQty} шт`)
  console.log(`6. Active cards currently running in Shop 2: ${shop2ActiveCardsQty} шт`)
}

testExactShop2BufferMath().catch(console.error)
