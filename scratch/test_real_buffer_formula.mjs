import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testFormula() {
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, card_info, task_id')

  const { data: tasks } = await supabase.from('tasks').select('id, step')
  const shop2TaskIds = new Set(
    tasks?.filter(t => {
      const s = (t.step || '').toLowerCase()
      return s.includes('цех №2') || s.includes('пресування') || s.includes('доопрацювання') || s.includes('цех 2')
    }).map(t => t.id) || []
  )

  const isShop2Card = (c) => {
    if (c.task_id && shop2TaskIds.has(c.task_id)) return true
    const op = (c.operation || '').toLowerCase()
    return op.includes('пресування') || op.includes('фарбування') || op.includes('малярка') || op.includes('доопрацювання') || op.includes('пакування') || op.includes('склад сгп')
  }

  // Cards physically in Shop 2 Buffer:
  // A Shop 1 card (not Shop 2 card) whose operation is 'Сортування', 'Прийомка', or 'Склад БЗ'
  // AND whose status is 'at-buffer' or 'at-shop2-buffer'
  // AND whose available quantity (quantity - used_in_shop2_qty) > 0
  const realBufferCards = cards.filter(c => {
    if (isShop2Card(c)) return false
    const status = c.status || ''
    const op = c.operation || ''

    const isSortedOrBuffer = (status === 'at-buffer' || status === 'at-shop2-buffer') &&
      (op === 'Сортування' || op === 'Прийомка' || op === 'Склад БЗ' || status === 'at-shop2-buffer')

    if (!isSortedOrBuffer) return false
    const avail = Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0))
    return avail > 0
  })

  console.log('=== REAL SHOP 2 BUFFER CARDS COUNT:', realBufferCards.length)
  let totalAvail = 0
  const byNom = {}

  realBufferCards.forEach(c => {
    const avail = Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0))
    totalAvail += avail
    byNom[c.nomenclature_id] = (byNom[c.nomenclature_id] || 0) + avail
    console.log(`ID: ${c.id.slice(-8)} | Nom: ${c.nomenclature_id} | Op: "${c.operation}" | Status: "${c.status}" | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty} | Avail: ${avail}`)
  })

  console.log('\n=============================================')
  console.log(`TOTAL REAL SHOP 2 BUFFER AVAILABLE: ${totalAvail} шт`)
  console.log('=============================================')
  console.log('By Nomenclature:', byNom)
}

testFormula()
