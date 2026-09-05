import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
})

async function main() {
  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .ilike('id', '%def1c659%')
  
  console.log('Card #DEF1C659:', JSON.stringify(cards, null, 2))

  if (cards && cards.length > 0) {
    const card = cards[0]
    // Check material requests for this nomenclature or task
    const { data: reqs } = await supabase
      .from('material_requests')
      .select('*')
      .eq('task_id', card.task_id)
    console.log('\nTask requests count:', reqs?.length)
    reqs?.forEach(r => {
      console.log(`Req: ${r.id} | status: ${r.status} | nom: ${r.nomenclature_id} | details: ${r.details}`)
    })
  }
}

main().catch(console.error)
