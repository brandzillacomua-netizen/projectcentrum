import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  console.log("Searching nomenclatures containing 'F613', 'F610', 'ІП24', 'ІП47'...")
  const { data: noms } = await supabase.from('nomenclatures').select('*')
  
  const filtered = noms.filter(n => {
    const name = n.name.toLowerCase()
    return name.includes('f613') || name.includes('f610') || name.includes('іп24') || name.includes('іп47')
  })
  
  console.log(`Found ${filtered.length} matches:`)
  filtered.forEach(n => {
    console.log(`- ID: ${n.id}, Code: ${n.nomenclature_code || n.base_code}, Name: "${n.name}", Type: ${n.type}, Created: ${n.created_at}`)
  })
}

run()
