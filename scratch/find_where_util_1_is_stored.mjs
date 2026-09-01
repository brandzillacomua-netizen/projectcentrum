import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function findUtil1() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: history } = await supabase.from('work_card_history').select('*')

  console.log('Cards with scrap_qty > 0:')
  cards.filter(c => c.scrap_qty > 0).forEach(c => {
    console.log(`Card ${c.id}: nom=${c.nomenclature_id}, scrap=${c.scrap_qty}, info=${c.card_info}`)
  })

  console.log('\nHistory with scrap_qty > 0:')
  history.filter(h => h.scrap_qty > 0).forEach(h => {
    console.log(`History ${h.id}: card=${h.card_id}, nom=${h.nomenclature_id}, scrap=${h.scrap_qty}, info=${h.card_info}`)
  })

  console.log('\nCards with VKYA / scrap / util in card_info:')
  cards.filter(c => c.card_info?.includes('VKY') || c.card_info?.includes('SCRAP') || c.card_info?.includes('UTIL') || c.card_info?.includes('утиль')).forEach(c => {
    console.log(`Card ${c.id}: info=${c.card_info}`)
  })

  console.log('\nHistory with VKYA / scrap / util in notes/card_info:')
  history.filter(h => (h.notes?.includes('VKY') || h.notes?.includes('брак') || h.notes?.includes('утиль') || h.card_info?.includes('VKY'))).forEach(h => {
    console.log(`History ${h.id}: notes=${h.notes}, info=${h.card_info}`)
  })
}

findUtil1().catch(console.error)
