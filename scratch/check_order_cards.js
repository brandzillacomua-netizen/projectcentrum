import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', 'a7f6ab43-9013-40d8-8e8e-8c371323695d').eq('nomenclature_id', '5ecf63e5-802d-4f98-8291-aad9a52bfaa4')
  console.log('Cards for part -В-3-30 in 25062026-02:')
  cards?.forEach(c => {
    console.log(`- ID: ${c.id} | Qty: ${c.quantity} | Status: ${c.status} | actualSheets: ${c.actualSheets} | Info: ${c.card_info}`)
  })
}

main().catch(console.error)
