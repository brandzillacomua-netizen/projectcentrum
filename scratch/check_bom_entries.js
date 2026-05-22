import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkBOM() {
  const parentId = 'af2ab774-42e0-4617-9c2e-fe1e3c61d6a2'
  const { data: boms } = await supabase.from('bom_items').select('*').eq('parent_id', parentId)
  
  console.log('BOM items for parent:')
  for (const b of boms) {
    const { data: child } = await supabase.from('nomenclatures').select('name, created_at').eq('id', b.child_id).single()
    console.log(`- BOM ID: ${b.id}, Child: "${child?.name}" (${b.child_id}), Qty: ${b.quantity_per_parent}, Child Created At: ${child?.created_at}`)
  }
}

checkBOM()
