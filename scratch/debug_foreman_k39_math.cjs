const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

function countAsProduced(card) {
  return ['completed', 'at-shop2-buffer', 'at-buffer', 'waiting-buffer'].includes(card?.status)
}

async function run() {
  const taskId = '23ceb083-47f2-4f00-9922-339318478043'
  const nomId = 'c6e25b2b-5fec-432c-a0fc-fc16be80d271'

  // Fetch work_cards, archiveCards, work_card_history
  const { data: workCards } = await supabase.from('work_cards').select('*').eq('task_id', taskId)
  const { data: history } = await supabase.from('work_card_history').select('*').eq('task_id', taskId)

  const nomCards = workCards.filter(c => String(c.nomenclature_id) === String(nomId))
  const laserCards = nomCards.filter(c => c.operation !== 'Склад БЗ')

  console.log(`Total nomCards: ${nomCards.length}`)
  console.log(`Total laserCards: ${laserCards.length}`)

  let grossCutOnLaser = 0
  laserCards.forEach(c => {
    const isProd = countAsProduced(c)
    console.log(`Card #${c.id.slice(-8)} | qty: ${c.quantity} | op: ${c.operation} | status: ${c.status} | countAsProduced: ${isProd}`)
    if (isProd) grossCutOnLaser += (Number(c.quantity) || 0)
  })

  console.log(`\ngrossCutOnLaser calculated: ${grossCutOnLaser}`)

  // Let's check history entries for this task and nomenclature!
  const nomHistory = history.filter(h => String(h.nomenclature_id) === String(nomId) || nomCards.some(c => String(c.id) === String(h.card_id)))
  console.log(`\nTotal history logs for this part: ${nomHistory.length}`)
  nomHistory.forEach(h => {
    console.log(`History #${h.id} | card_id: ${h.card_id?.slice(-8)} | qty_completed: ${h.qty_completed} | scrap_qty: ${h.scrap_qty} | operation: ${h.operation}`)
  })
}

run()
