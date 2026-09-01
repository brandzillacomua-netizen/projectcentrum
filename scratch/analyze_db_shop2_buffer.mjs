import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  const { data: cards, error } = await supabase.from('work_cards').select('id, task_id, nomenclature_id, status, operation, quantity, used_in_shop2_qty, card_info')
  if (error) console.error(error)

  const { data: nomList } = await supabase.from('nomenclatures').select('id, name')
  const nomMap = new Map(nomList.map(n => [n.id, n.name]))

  console.log(`Total work cards in DB: ${cards?.length}`)

  // Group by status
  const byStatus = {}
  cards.forEach(c => {
    byStatus[c.status] = (byStatus[c.status] || 0) + 1
  })
  console.log('Work cards count by status:', byStatus)

  // Group by status & operation
  const byStatusOp = {}
  cards.forEach(c => {
    const key = `[status: ${c.status}] [op: ${c.operation}]`
    byStatusOp[key] = (byStatusOp[key] || 0) + 1
  })
  console.log('\nWork cards count by status & operation:', byStatusOp)

  // Show details of cards with status === 'at-shop2-buffer'
  const shop2BufCards = cards.filter(c => c.status === 'at-shop2-buffer')
  console.log(`\nCards with status === 'at-shop2-buffer': ${shop2BufCards.length}`)
  let totalQtyShop2Buf = 0
  let totalAvailShop2Buf = 0
  shop2BufCards.forEach(c => {
    const qty = Number(c.quantity) || 0
    const used = Number(c.used_in_shop2_qty) || 0
    const avail = Math.max(0, qty - used)
    totalQtyShop2Buf += qty
    totalAvailShop2Buf += avail
    console.log(`  Card ${c.id.slice(-8)} | Nom: ${nomMap.get(c.nomenclature_id)} | Qty: ${qty} | Used: ${used} | Avail: ${avail} | Op: ${c.operation}`)
  })
  console.log(`Total Qty at-shop2-buffer: ${totalQtyShop2Buf}, Total Avail (Qty-Used): ${totalAvailShop2Buf}`)

  // Check if there are cards with status === 'at-buffer' or 'completed' on Sorting
  const sortingCards = cards.filter(c => (c.operation || '').includes('Сортування'))
  console.log(`\nSorting operation cards count: ${sortingCards.length}`)
  sortingCards.forEach(c => {
    console.log(`  Sorting Card ${c.id.slice(-8)} | Status: ${c.status} | Nom: ${nomMap.get(c.nomenclature_id)} | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty}`)
  })
}

run().catch(console.error)
