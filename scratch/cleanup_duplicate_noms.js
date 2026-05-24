import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const duplicates = [
  { thickness: '2мм', keep: 'a78b411e-d42f-4d36-9bf2-116adc9fcd36', del: '782108df-3714-4a0b-9105-e41a37ca1ff8' },
  { thickness: '3мм', keep: '533b56b0-c252-46b2-ba28-557f08d7de06', del: 'b7fc6069-5d16-4ed5-9d26-c3ff66de0d67' },
  { thickness: '4мм', keep: 'e6e9c853-c9b0-488d-9568-bbb3a9653546', del: '9a86ecf7-74cf-41fb-aa29-bd9a8fe55376' },
  { thickness: '5мм', keep: '69efa971-e5fc-42e2-922e-81da1d251868', del: 'f464d339-cb97-463c-90eb-f1e044060644' },
  { thickness: '7мм', keep: 'cbe1b327-1dbf-45fd-a2ce-a92ef200169c', del: 'a25c0cc5-8b2c-4081-bbf4-3993f82dd901' }
]

async function run() {
  console.log("Migrating references from duplicate nomenclatures to keep nomenclatures...")
  
  for (const pair of duplicates) {
    console.log(`\nProcessing ${pair.thickness}: Keep ID ${pair.keep} | Duplicate ID ${pair.del}`)
    
    // 1. Migrate inventory references
    const { error: invErr } = await supabase
      .from('inventory')
      .update({ nomenclature_id: pair.keep })
      .eq('nomenclature_id', pair.del)
    if (invErr) console.error("  Error updating inventory:", invErr.message)
    
    // 2. Migrate material_requests references
    const { error: reqErr } = await supabase
      .from('material_requests')
      .update({ nomenclature_id: pair.keep })
      .eq('nomenclature_id', pair.del)
    if (reqErr) console.error("  Error updating material_requests:", reqErr.message)

    // 3. Migrate work_cards references
    const { error: cardErr } = await supabase
      .from('work_cards')
      .update({ nomenclature_id: pair.keep })
      .eq('nomenclature_id', pair.del)
    if (cardErr) console.error("  Error updating work_cards:", cardErr.message)

    // 4. Migrate bom_items references (child_id)
    const { error: bomChildErr } = await supabase
      .from('bom_items')
      .update({ child_id: pair.keep })
      .eq('child_id', pair.del)
    if (bomChildErr) console.error("  Error updating bom_items (child_id):", bomChildErr.message)

    // 5. Migrate bom_items references (parent_id)
    const { error: bomParentErr } = await supabase
      .from('bom_items')
      .update({ parent_id: pair.keep })
      .eq('parent_id', pair.del)
    if (bomParentErr) console.error("  Error updating bom_items (parent_id):", bomParentErr.message)

    // 6. Delete duplicate nomenclature row
    console.log(`  Deleting duplicate nomenclature: ${pair.del}`)
    const { error: delErr } = await supabase
      .from('nomenclatures')
      .delete()
      .eq('id', pair.del)
    if (delErr) console.error("  Error deleting nomenclature:", delErr.message)
  }

  console.log("\nDuplicate nomenclatures cleanup completed successfully.")
}

run()
