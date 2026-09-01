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
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: nomList } = await supabase.from('nomenclatures').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')

  const nomMap = new Map(nomList.map(n => [n.id, n]))

  console.log('=== CARDS WITH status = at-shop2-buffer ===')
  const s2BufCards = cards.filter(c => c.status === 'at-shop2-buffer')
  console.log(`Total count of cards with status 'at-shop2-buffer': ${s2BufCards.length}`)

  const availMap = {}
  s2BufCards.forEach(c => {
    const qty = Number(c.quantity) || 0
    const used = Number(c.used_in_shop2_qty) || 0
    const avail = Math.max(0, qty - used)
    const nomName = nomMap.get(c.nomenclature_id)?.name || c.nomenclature_id
    if (!availMap[nomName]) availMap[nomName] = { totalQty: 0, totalUsed: 0, totalAvail: 0, cardsCount: 0 }
    availMap[nomName].totalQty += qty
    availMap[nomName].totalUsed += used
    availMap[nomName].totalAvail += avail
    availMap[nomName].cardsCount += 1
  })

  console.log('\nBreakdown of at-shop2-buffer cards by nomenclature:')
  Object.entries(availMap).forEach(([nomName, data]) => {
    console.log(`  ${nomName}: cards=${data.cardsCount}, totalQty=${data.totalQty}, totalUsed=${data.totalUsed}, avail=${data.totalAvail}`)
  })

  console.log('\n=== OTHER WORK CARDS IN SYSTEM ===')
  const otherByStatus = {}
  cards.forEach(c => {
    const key = `[op: ${c.operation}] [status: ${c.status}]`
    otherByStatus[key] = (otherByStatus[key] || 0) + 1
  })
  console.log(otherByStatus)
}

run().catch(console.error)
