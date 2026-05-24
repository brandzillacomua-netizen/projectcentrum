import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: noms, error } = await supabase
    .from('nomenclatures')
    .select('id, name, type, created_at')
    .eq('type', 'product')
    
  if (error) {
    console.error('Error:', error)
    return
  }
  
  console.log("All products in database:")
  noms.forEach(n => {
    console.log(`- ID: ${n.id}, Name: "${n.name}", Created: ${n.created_at}`)
  })
}

run()
