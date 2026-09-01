import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectS1History() {
  const s1TaskId = '35c6045a-4da1-47d2-b73f-7d269ba1e3a3'
  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec' // Detail 1

  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  const s1Cards = (cards || []).filter(c => String(c.task_id) === String(s1TaskId) && String(c.nomenclature_id) === String(nomId))
  const cardIdsStrings = s1Cards.map(c => String(c.id))

  const groupHistory = (history || []).filter(h => h.card_id && cardIdsStrings.includes(String(h.card_id)))

  console.log('s1Cards count:', s1Cards.length)
  console.log('groupHistory count:', groupHistory.length)

  groupHistory.forEach(h => {
    console.log(JSON.stringify(h))
  })
}

inspectS1History().catch(console.error)
