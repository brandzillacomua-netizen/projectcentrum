import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const partIds = [
    '343417a7-4a5c-4e31-8f44-18abb41defec',
    '50947afc-4e40-4165-a682-780275d5feda',
    '5ecf63e5-802d-4f98-8291-aad9a52bfaa4',
    'b77e0883-0af2-40a4-a834-a1e47b6570da'
  ]

  const { data, error } = await supabase
    .from('machine_operations')
    .select('*')
    .in('nomenclature_id', partIds)

  if (error) {
    console.error('Error fetching machine operations:', error)
    return
  }

  console.log(`Found ${data.length} machine operations:`)
  data.forEach(row => {
    console.log(`ID: ${row.id}`)
    console.log(`  nomenclature_id: ${row.nomenclature_id}`)
    console.log(`  machine_type: ${row.machine_type}, machine_id: ${row.machine_id}`)
    console.log(`  side2_cut_ops:`, JSON.stringify(row.side2_cut_ops))
  })
}

main().catch(console.error)
