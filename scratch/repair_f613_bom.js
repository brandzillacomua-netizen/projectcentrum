import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const f613ParentId = '815f422e-336c-40bb-8507-d3a6c8bbd600'
  const sharedParts = [
    { name: 'F610-ІП24-В-3-15', id: 'a3498c79-c914-4526-8abf-a56fd0735794', qty: 1 },
    { name: 'F610-ІП24-Н-3-14', id: '7e8d056d-06b2-42a7-88e1-12186b914948', qty: 1 },
    { name: 'КН-Нх10-F610-Х-2-12', id: '7e4c4c6d-1d0b-45ce-a7a4-fff46d0578fd', qty: 1 }
  ]

  console.log('Checking existing BOM items for F613 parent...')
  const { data: existingBoms, error: fetchErr } = await supabase
    .from('bom_items')
    .select('*')
    .eq('parent_id', f613ParentId)

  if (fetchErr) {
    console.error('Error fetching BOM items:', fetchErr)
    return
  }

  console.log('Existing BOM items:', existingBoms)

  const toInsert = []
  for (const part of sharedParts) {
    const exists = existingBoms.some(b => String(b.child_id) === String(part.id))
    if (!exists) {
      toInsert.push({
        parent_id: f613ParentId,
        child_id: part.id,
        quantity_per_parent: part.qty
      })
      console.log(`Will insert missing relation: F613 -> ${part.name} (${part.id})`)
    } else {
      console.log(`Relation already exists: F613 -> ${part.name} (${part.id})`)
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('bom_items')
      .insert(toInsert)
      .select()

    if (insertErr) {
      console.error('Error inserting BOM items:', insertErr)
    } else {
      console.log('Successfully inserted BOM items:', inserted)
    }
  } else {
    console.log('No missing relations to insert.')
  }
}

run()
