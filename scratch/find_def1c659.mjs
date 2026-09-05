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
    .select('id, card_info, quantity, status, nomenclature_id')
    .eq('order_id', 'ac91435d-a0a2-43d6-80d4-b356c18e5654')
  
  console.log('Cards found:', cards?.length)
  cards?.forEach(c => {
    if (c.id.toLowerCase().includes('def1c659') || c.id.toLowerCase().includes('def1') || c.id.toLowerCase().endsWith('659')) {
      console.log('MATCH:', c)
    }
    console.log(c.id.slice(-8), c.quantity, c.status, c.card_info)
  })
}

main().catch(console.error)
