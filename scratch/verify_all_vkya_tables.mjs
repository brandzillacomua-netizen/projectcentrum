import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function verifyAllVkyaTables() {
  const nomId = '50947afc-4e40-4165-a682-780275d5feda'

  const { data: classifications } = await supabase.from('scrap_classifications').select('*').eq('nomenclature_id', nomId)
  console.log('Classifications count:', classifications?.length || 0)
  classifications?.forEach(c => console.log('Classification:', c))

  const { data: inventory } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId)
  console.log('\nInventory for nomId:', inventory)
}

verifyAllVkyaTables().catch(console.error)
