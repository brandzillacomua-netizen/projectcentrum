import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: types, error } = await supabase
    .from('nomenclature_types')
    .select('*')
    
  if (error) {
    console.error('Error fetching nomenclature_types:', error)
    return
  }
  
  console.log("Nomenclature types in database:")
  types.forEach(t => {
    console.log(`- ID: ${t.id}, Name: "${t.name}"`)
  })
}

run()
