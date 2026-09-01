import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

// Restore inventory for test cutters to total_qty: 999, reserved_qty: 0
const nomIds = [
  'd23887da-d00a-45a3-bf56-6cc9b0c8cd4b',
  '74f0cdca-89ee-4063-9960-612e6612ae24',
  'b3f085a2-d2e2-4ece-905a-656e47024aab'
]

for (const nomId of nomIds) {
  await supabase
    .from('inventory')
    .update({ total_qty: 999, reserved_qty: 0 })
    .eq('nomenclature_id', nomId)
}

console.log('✅ Restored inventory total_qty to 999 and reserved_qty to 0!')
