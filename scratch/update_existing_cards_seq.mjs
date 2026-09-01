import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Update any active work cards whose card_info has '№1' without '/1' to '№1/1'
const { data: cards } = await supabase
  .from('work_cards')
  .select('id, card_info')
  .not('status', 'eq', 'completed')

let updatedCount = 0
for (const card of cards || []) {
  const info = card.card_info || ''
  // Match №1 or №2 etc. that doesn't have a slash after the number
  if (/№\d+(?!\/)/.test(info)) {
    const newInfo = info.replace(/№(\d+)(?!\/)/g, '№$1/1')
    await supabase.from('work_cards').update({ card_info: newInfo }).eq('id', card.id)
    updatedCount++
  }
}

console.log(`✅ Updated ${updatedCount} existing work cards card_info sequence formats!`)
