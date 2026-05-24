import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: boms, error } = await supabase
    .from('bom_items')
    .select('parent_id')
    
  if (error) {
    console.error('Error fetching bom_items:', error)
    return
  }
  
  const parentIds = [...new Set(boms.map(b => b.parent_id))]
  console.log(`Found ${parentIds.length} unique parent IDs with BOM items.`)
  
  const { data: noms, error: nomError } = await supabase
    .from('nomenclatures')
    .select('id, name, type')
    .in('id', parentIds)
    
  if (nomError) {
    console.error('Error fetching nomenclatures:', nomError)
    return
  }
  
  console.log("Nomenclatures with BOM items:")
  noms.forEach(n => {
    const count = boms.filter(b => b.parent_id === n.id).length
    console.log(`- ID: ${n.id}, Name: "${n.name}", Type: "${n.type}", Items count: ${count}`)
  })
}

run()
