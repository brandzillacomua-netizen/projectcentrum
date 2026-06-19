const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
// Using the key from src/supabase.js
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  console.log('Checking if group_label column exists in bom_items...')
  
  // Try to read a bom_item row with group_label
  const { data, error } = await supabase.from('bom_items').select('id, group_label').limit(1)
  
  if (error) {
    console.log('group_label column does NOT exist. Error:', error.message)
    console.log('\nTo add it, run this SQL in Supabase SQL editor:')
    console.log('\nALTER TABLE bom_items ADD COLUMN IF NOT EXISTS group_label TEXT DEFAULT \'Деталі\';')
  } else {
    console.log('✅ group_label column EXISTS. Sample:', data)
  }
}

main().catch(console.error)
