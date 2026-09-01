import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkGhostBug() {
  const { data: history } = await supabase.from('work_card_history').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const nomId = '50947afc-4e40-4165-a682-780275d5feda' // Detail 2

  const nomCards = cards.filter(c => String(c.nomenclature_id) === nomId)
  const cardIds = new Set(nomCards.map(c => String(c.id)))

  const nomHistoryScrap = history.filter(h =>
    Number(h.scrap_qty) > 0 &&
    (String(h.nomenclature_id) === nomId || (h.card_id && cardIds.has(String(h.card_id))))
  )

  console.log('All scrap history rows for Detail 2 count:', nomHistoryScrap.length)
  nomHistoryScrap.forEach(h => {
    console.log(`History row ${h.id}: card=${h.card_id}, stage=${h.stage_name}, scrap_qty=${h.scrap_qty}, is_archived_scrap=${h.is_archived_scrap}, info=${h.card_info}`)
  })
}

checkGhostBug().catch(console.error)
