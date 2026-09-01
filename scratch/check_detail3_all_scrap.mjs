import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkDetail3Scrap() {
  const { data: history } = await supabase.from('work_card_history').select('*')
  const nomId3 = '5ecf63e5-802d-4f98-8291-aad9a52bfaa4' // Detail 3

  const scrapHist = history.filter(h => String(h.nomenclature_id) === nomId3 && Number(h.scrap_qty) > 0)
  console.log('Detail 3 history scrap entries count:', scrapHist.length)

  scrapHist.forEach(h => {
    console.log(`Hist ${h.id}: card=${h.card_id}, scrap=${h.scrap_qty}, is_archived=${h.is_archived_scrap}, stage=${h.stage_name}, info=${h.card_info}`)
  })
}

checkDetail3Scrap().catch(console.error)
