import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function inspectF613() {
  const { data: products } = await supabase.from('nomenclatures').select('*').ilike('name', '%інд.проект 47%')
  console.log('F613 products:', JSON.stringify(products, null, 2))

  if (products && products.length > 0) {
    const parentId = products[0].id
    const { data: boms } = await supabase.from('bom_items').select('*').eq('parent_id', parentId)
    console.log(`\nBOM count for ${products[0].name}: ${boms?.length || 0}`)
    if (boms) {
      for (const b of boms) {
        const { data: child } = await supabase.from('nomenclatures').select('name, type').eq('id', b.child_id).single()
        console.log(`- Child: "${child?.name}" (${child?.type}), Qty: ${b.quantity_per_parent}`)
      }
    }
  }
}

inspectF613()
