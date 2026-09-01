import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectCards() {
  const { data: cards, error } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, card_info, task_id')

  if (error) { console.error(error); return }

  console.log('=== ALL CARDS IN DB:', cards.length)

  // 1. Cards with status at-shop2-buffer
  const shop2Buf = cards.filter(c => c.status === 'at-shop2-buffer')
  console.log('\n--- Cards with status = at-shop2-buffer ---')
  shop2Buf.forEach(c => {
    console.log(`ID: ${c.id.slice(-8)} | NomID: ${c.nomenclature_id} | Op: "${c.operation}" | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty} | TaskID: ${c.task_id} | Info: ${c.card_info}`)
  })

  // 2. Cards with operation containing Сортування
  const sortCards = cards.filter(c => (c.operation || '').toLowerCase().includes('сортування'))
  console.log('\n--- Cards with operation containing Сортування ---')
  sortCards.forEach(c => {
    console.log(`ID: ${c.id.slice(-8)} | NomID: ${c.nomenclature_id} | Op: "${c.operation}" | Status: "${c.status}" | Qty: ${c.quantity} | TaskID: ${c.task_id}`)
  })

  // 3. All distinct statuses in work_cards
  const statuses = {}; cards.forEach(c => { statuses[c.status] = (statuses[c.status] || 0) + 1 })
  console.log('\n--- Distinct Statuses ---', statuses)

  // 4. All distinct operations in work_cards
  const ops = {}; cards.forEach(c => { ops[c.operation] = (ops[c.operation] || 0) + 1 })
  console.log('\n--- Distinct Operations ---', ops)
}

inspectCards()
