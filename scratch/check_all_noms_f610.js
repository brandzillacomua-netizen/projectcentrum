import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: noms, error } = await supabase
    .from('nomenclatures')
    .select('*')
    
  if (error) {
    console.error('Error fetching nomenclatures:', error)
    return
  }
  
  console.log("Searching for 'інд.проект 24' or 'інд. проект 24' or 'F610':")
  noms.filter(n => 
    n.name.toLowerCase().includes('інд.проект 24') || 
    n.name.toLowerCase().includes('інд. проект 24') || 
    n.name.toLowerCase().includes('f610')
  ).forEach(n => {
    console.log(`- ID: ${n.id}, Name: "${n.name}", Type: "${n.type}", Created: ${n.created_at}`)
  })
}

run()
