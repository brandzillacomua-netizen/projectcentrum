import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function testScrapDetails() {
  const { data: history } = await supabase.from('work_card_history').select('*')
  const nomId = '343417a7-4a5c-4e31-8f44-18abb41defec' // Detail 1

  const nomHist = (history || []).filter(h => String(h.nomenclature_id) === String(nomId))
  console.log('Nom history count:', nomHist.length)

  nomHist.forEach(h => {
    console.log(JSON.stringify({
      id: h.id,
      card_id: h.card_id,
      scrap_qty: h.scrap_qty,
      action: h.action,
      notes: h.notes,
      card_info: h.card_info,
      stage_name: h.stage_name
    }))
  })
}

testScrapDetails().catch(console.error)
