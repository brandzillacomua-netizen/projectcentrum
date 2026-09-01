import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkMasterBz() {
  const { data: cards } = await supabase.from('work_cards').select('*')

  const card39 = cards.filter(c => c.card_info?.includes('260827-2') && c.card_info?.includes('3-39'))
  console.log('Cards for 3-39:', card39.map(c => ({ id: c.id, qty: c.quantity, status: c.status, scrap: c.scrap_qty, info: c.card_info })))
}

checkMasterBz().catch(console.error)
