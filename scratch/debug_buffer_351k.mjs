import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey)

async function debugBufferTotal() {
  const { data: inv } = await supabase
    .from('inventory')
    .select('*')

  console.log('Total inventory rows:', inv?.length)
  const bzInv = inv?.filter(i => i.type === 'bz' || i.type === 'bz_shop2' || i.type === 'semi_shop2') || []
  console.log('BZ inventory rows:', bzInv.length)
  let bzSum = 0
  bzInv.forEach(i => {
    console.log(`Inv ID: ${i.id} | Nom: ${i.nomenclature_id} | Type: ${i.type} | Qty: ${i.total_qty}`)
    bzSum += (Number(i.total_qty) || 0)
  })
  console.log('Total BZ Inventory Qty:', bzSum)

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, card_info')

  console.log('\nTotal work_cards:', cards?.length)
  let cardBufSum = 0
  cards?.forEach(c => {
    const op = String(c.operation || '')
    const status = String(c.status || '')
    const isSortedOrBuffer = 
      status === 'at-shop2-buffer' || 
      status === 'at-buffer' || 
      op === 'Склад БЗ' ||
      (status === 'completed' && (op === 'Сортування' || op === 'Прийомка')) ||
      ((status === 'at-buffer' || status === 'completed') && (c.is_rework || Boolean(c.card_info?.includes('[REDO]'))))

    if (isSortedOrBuffer) {
      const qty = Number(c.quantity || 0)
      const used = Number(c.used_in_shop2_qty || 0)
      const avail = Math.max(0, qty - used)
      cardBufSum += avail
      if (avail > 1000) {
        console.log(`LARGE CARD: ID: ${c.id} | Nom: ${c.nomenclature_id} | Op: ${op} | Status: ${status} | Qty: ${qty} | Used: ${used} | Avail: ${avail}`)
      }
    }
  })
  console.log('Total Card Buffer Qty:', cardBufSum)
  console.log('SUM ALL (Cards + BZ Inv):', cardBufSum + bzSum)
}

debugBufferTotal()
