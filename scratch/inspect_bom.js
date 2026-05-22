import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkBOM() {
  const parents = [
    { id: 'af2ab774-42e0-4617-9c2e-fe1e3c61d6a2', name: "Рама KHARAK 10`(210)" },
    { id: '56e8db22-7a7c-4a48-812c-561c95775be9', name: "Рама KHARAK 10`(218)" }
  ]

  for (const parent of parents) {
    const { data: boms } = await supabase.from('bom_items').select('*').eq('parent_id', parent.id)
    console.log(`\nBOM items for parent: ${parent.name} (${parent.id}) - total count: ${boms ? boms.length : 0}`)
    if (boms) {
      for (const b of boms) {
        const { data: child } = await supabase.from('nomenclatures').select('name, type').eq('id', b.child_id).single()
        console.log(`- Child: "${child?.name}" (${child?.type}), Qty: ${b.quantity_per_parent}`)
      }
    }
  }
}

checkBOM()
