import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkRecentNoms() {
  const { data: noms } = await supabase.from('nomenclatures').select('*')
  
  console.log("Nomenclatures created on May 21st / 22nd:")
  const recent = noms.filter(n => n.created_at && (n.created_at.startsWith('2026-05-21') || n.created_at.startsWith('2026-05-22')))
  recent.forEach(n => {
    console.log(`- ID: ${n.id}, Name: "${n.name}", Type: ${n.type}, Created: ${n.created_at}`)
  })
}

checkRecentNoms()
