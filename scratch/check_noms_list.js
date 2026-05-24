import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: noms } = await supabase.from('nomenclatures').select('*')
  console.log("All sheets in nomenclatures table:")
  noms.filter(n => n.name.toLowerCase().includes('лист') && n.name.toLowerCase().includes('300')).forEach(n => {
    console.log(`- ID: ${n.id} | Name: "${n.name}" | MatType: "${n.material_type}" | Type: "${n.type}"`)
  })
}

run()
