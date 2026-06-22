import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  // 1. Clean up incorrect 'sgp' warehouse records we created earlier
  console.log("Cleaning up temporary 'sgp' records...")
  const { error: errDelete } = await supabase
    .from('inventory')
    .delete()
    .eq('warehouse', 'sgp')
    .in('nomenclature_id', ['5ecf63e5-802d-4f98-8291-aad9a52bfaa4', 'b77e0883-0af2-40a4-a834-a1e47b6570da'])
  
  if (errDelete) {
    console.error("Error deleting sgp records:", errDelete)
  } else {
    console.log("Temporary 'sgp' records deleted successfully.")
  }

  // 2. Define our target items for Finished Goods (Готова продукція)
  const targets = [
    {
      id: '5ecf63e5-802d-4f98-8291-aad9a52bfaa4',
      name: 'Київ К-ІП9/10/31/36/37-9-10-11-В-3-30',
      targetQty: 8240
    },
    {
      id: 'b77e0883-0af2-40a4-a834-a1e47b6570da',
      name: 'Київ К-ІП9-10-П-7-46',
      targetQty: 20030
    }
  ]

  for (const t of targets) {
    console.log(`Upserting Finished Good: ${t.name} -> Qty: ${t.targetQty}`)
    
    // Check if record exists for (name, type, warehouse) -> (t.name, 'finished', 'operational')
    const { data: existing, error: errExist } = await supabase
      .from('inventory')
      .select('*')
      .eq('name', t.name)
      .eq('type', 'finished')
      .eq('warehouse', 'operational')
      .maybeSingle()

    if (errExist) {
      console.error(`Error checking existing finished record for ${t.name}:`, errExist)
      continue
    }

    if (existing) {
      console.log(`Found existing record. Updating quantity to ${t.targetQty}...`)
      const { error: errUpdate } = await supabase
        .from('inventory')
        .update({
          total_qty: t.targetQty,
          nomenclature_id: t.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
      
      if (errUpdate) console.error("Update error:", errUpdate)
      else console.log("Update success!")
    } else {
      console.log("No existing record found. Inserting new record...")
      const { error: errInsert } = await supabase
        .from('inventory')
        .insert([{
          nomenclature_id: t.id,
          name: t.name,
          unit: 'шт',
          total_qty: t.targetQty,
          warehouse: 'operational',
          type: 'finished',
          updated_at: new Date().toISOString()
        }])

      if (errInsert) console.error("Insert error:", errInsert)
      else console.log("Insert success!")
    }
  }
}

run()
