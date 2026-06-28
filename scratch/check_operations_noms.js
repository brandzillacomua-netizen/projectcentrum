import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data, error } = await supabase
    .from('nomenclatures')
    .select('*')
    .eq('type', 'consumable')

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`Found ${data.length} consumables:`)
  data.forEach(n => {
    if (n.name.toLowerCase().includes('уп') || n.name.toLowerCase().includes('прогонка') || n.name.toLowerCase().includes('лінії')) {
      console.log(`- ID: ${n.id} | Name: "${n.name}" | consumption_per_sheet: ${n.consumption_per_sheet}`)
    }
  })
}

main().catch(console.error)
