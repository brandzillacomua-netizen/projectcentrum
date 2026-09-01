import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function findRealShop2Buffer() {
  // Fetch all work cards
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, card_info, task_id, is_rework')

  if (error) { console.error(error); return }
  console.log('Total cards:', cards.length)

  // Shop 2 task IDs (tasks that have Пресування / ЦЕХ №2 / Малярка operations)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, step, status')
  
  const shop2TaskIds = new Set(
    tasks?.filter(t => {
      const s = (t.step || '').toLowerCase()
      return s.includes('цех №2') || s.includes('пресування') || s.includes('доопрацювання') || s.includes('цех 2')
    }).map(t => t.id) || []
  )
  console.log('Shop2 task IDs count:', shop2TaskIds.size)

  const isShop2Card = (c) => {
    if (c.task_id && shop2TaskIds.has(c.task_id)) return true
    const op = (c.operation || '').toLowerCase()
    return op.includes('пресування') || op.includes('фарбування') || op.includes('малярка') || op.includes('доопрацювання') || op.includes('пакування') || op.includes('склад сгп')
  }

  // Cards that are NOT shop2 cards and are at-buffer or at-shop2-buffer
  const atBuffer = cards.filter(c => {
    if (isShop2Card(c)) return false
    return c.status === 'at-buffer' || c.status === 'at-shop2-buffer'
  })

  console.log('\n=== NON-SHOP2 CARDS IN BUFFER (at-buffer / at-shop2-buffer) ===')
  console.log('Count:', atBuffer.length)
  
  let totalQty = 0
  atBuffer.forEach(c => {
    const qty = Number(c.quantity || 0)
    const used = Number(c.used_in_shop2_qty || 0)
    const avail = Math.max(0, qty - used)
    totalQty += avail
    console.log(`Op: ${c.operation?.padEnd(20)} | Status: ${c.status?.padEnd(18)} | Qty: ${qty} | Used: ${used} | Avail: ${avail} | CardID: ${c.id.slice(-8)}`)
  })
  console.log(`TOTAL AVAILABLE IN BUFFER: ${totalQty} шт`)

  // Now check at-shop2-buffer specifically (this is THE Shop 2 buffer)
  const shop2Buffer = cards.filter(c => c.status === 'at-shop2-buffer')
  console.log('\n=== ALL AT-SHOP2-BUFFER CARDS (regardless of shop) ===')
  console.log('Count:', shop2Buffer.length)
  let totalShop2BufQty = 0
  shop2Buffer.forEach(c => {
    const qty = Number(c.quantity || 0)
    const used = Number(c.used_in_shop2_qty || 0)
    const avail = Math.max(0, qty - used)
    totalShop2BufQty += avail
    console.log(`Op: ${c.operation?.padEnd(20)} | isShop2: ${isShop2Card(c)} | Qty: ${qty} | Used: ${used} | Avail: ${avail}`)
  })
  console.log(`TOTAL AT-SHOP2-BUFFER AVAILABLE: ${totalShop2BufQty} шт`)

  // Non-shop2 at-buffer
  const atBufOnly = cards.filter(c => !isShop2Card(c) && c.status === 'at-buffer')
  console.log('\n=== NON-SHOP2 CARDS AT-BUFFER (sorted after shop1, waiting shop2) ===')
  console.log('Count:', atBufOnly.length)
  let totalAtBuf = 0
  atBufOnly.forEach(c => {
    const qty = Number(c.quantity || 0)
    const used = Number(c.used_in_shop2_qty || 0)
    const avail = Math.max(0, qty - used)
    totalAtBuf += avail
    console.log(`Op: ${c.operation?.padEnd(20)} | Qty: ${qty} | Used: ${used} | Avail: ${avail}`)
  })
  console.log(`TOTAL AT-BUFFER NON-SHOP2 AVAILABLE: ${totalAtBuf} шт`)
}

findRealShop2Buffer()
