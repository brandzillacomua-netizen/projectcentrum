import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkBOM() {
  const parentId = 'cabab75e-92b0-4ab2-a636-563d32526d4e'
  const { data: boms } = await supabase.from('bom_items').select('*').eq('parent_id', parentId)
  console.log(`\nBOM items for F5 parent (${parentId}) - count: ${boms ? boms.length : 0}`)
  if (boms) {
    for (const b of boms) {
      const { data: child } = await supabase.from('nomenclatures').select('id, name, type, material_type').eq('id', b.child_id).single()
      console.log(`- Child ID: ${child?.id} | Name: "${child?.name}" | Type: "${child?.type}" | MatType: "${child?.material_type}", Qty: ${b.quantity_per_parent}`)
    }
  }
}

checkBOM()

