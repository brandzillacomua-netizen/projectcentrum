import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkShop2TerminalBufferNoWms() {
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, status, operation, quantity, used_in_shop2_qty, nomenclature_id, order_id, card_info, is_rework')
  
  const { data: tasks } = await supabase.from('tasks').select('id, step')

  const shop2TaskIds = new Set()
  tasks?.forEach(t => {
    const step = String(t.step || '').toLowerCase()
    if (step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування')) {
      shop2TaskIds.add(String(t.id))
    }
  })

  // Filter ONLY Route 1 & 2 cards
  const bufferCards = (cards || []).filter(c => {
    const isShop2Card = shop2TaskIds.has(String(c.task_id)) || c.card_info?.includes('[SHOP:2]')
    if (isShop2Card) return false
    return c.status === 'at-shop2-buffer' || c.is_rework || c.card_info?.includes('[REDO]')
  })

  let rawTotalQty = 0
  let usedQty = 0
  let freeQty = 0

  bufferCards.forEach(c => {
    const q = Number(c.quantity || 0)
    const u = Number(c.used_in_shop2_qty || 0)
    const avail = Math.max(0, q - u)

    rawTotalQty += q
    usedQty += u
    freeQty += avail
  })

  console.log('=== SHOP 2 TERMINAL BUFFER (WITHOUT WMS INVENTORY) ===')
  console.log(`1. Total Raw Received from Shop 1 / VKYA: ${rawTotalQty} шт`)
  console.log(`2. Used under active Shop 2 cards: ${usedQty} шт`)
  console.log(`3. REAL FREE AVAILABLE BUFFER FOR NEW CARDS: ${freeQty} шт`)
}

checkShop2TerminalBufferNoWms().catch(console.error)
