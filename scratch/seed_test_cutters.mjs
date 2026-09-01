import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const cutterNames = ['Тестова фреза 1', 'Тестова фреза 2', 'Тестова фреза 3']

  // Step 1: Find nomenclatures for these cutters
  const { data: noms, error: nomErr } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .in('name', cutterNames)

  if (nomErr) {
    console.error('Error fetching nomenclatures:', nomErr)
    process.exit(1)
  }

  console.log('Found nomenclatures:', noms)

  if (!noms || noms.length === 0) {
    console.error('No nomenclatures found for test cutters! Creating them...')
    // Create nomenclatures if they don't exist
    const toCreate = cutterNames.map(name => ({
      name,
      type: 'consumable',
      unit: 'шт'
    }))
    const { data: created, error: createErr } = await supabase
      .from('nomenclatures')
      .insert(toCreate)
      .select()
    if (createErr) {
      console.error('Error creating nomenclatures:', createErr)
      process.exit(1)
    }
    console.log('Created nomenclatures:', created)
    noms.push(...(created || []))
  }

  // Step 2: For each nomenclature, upsert inventory in operational warehouse
  for (const nom of noms) {
    // Check if inventory item already exists
    const { data: existing } = await supabase
      .from('inventory')
      .select('id, total_qty')
      .eq('nomenclature_id', nom.id)
      .eq('warehouse', 'operational')
      .maybeSingle()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('inventory')
        .update({ total_qty: 999, reserved_qty: 0 })
        .eq('id', existing.id)
      if (error) {
        console.error(`Error updating inventory for ${nom.name}:`, error)
      } else {
        console.log(`✅ Updated ${nom.name} → 999 шт. (was ${existing.total_qty})`)
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('inventory')
        .insert({
          nomenclature_id: nom.id,
          name: nom.name,
          type: 'consumable',
          warehouse: 'operational',
          total_qty: 999,
          reserved_qty: 0,
          unit: 'шт'
        })
      if (error) {
        console.error(`Error inserting inventory for ${nom.name}:`, error)
      } else {
        console.log(`✅ Created ${nom.name} → 999 шт. on operational warehouse`)
      }
    }
  }

  // Also check for any remaining cutters not found in nomenclatures by name-searching inventory
  const notFoundNames = cutterNames.filter(n => !noms.find(nom => nom.name === n))
  if (notFoundNames.length > 0) {
    console.log('Checking inventory directly for:', notFoundNames)
    for (const name of notFoundNames) {
      const { data: invItems } = await supabase
        .from('inventory')
        .select('id, name, total_qty')
        .ilike('name', `%${name}%`)
        .eq('warehouse', 'operational')
      
      if (invItems && invItems.length > 0) {
        for (const item of invItems) {
          const { error } = await supabase
            .from('inventory')
            .update({ total_qty: 999, reserved_qty: 0 })
            .eq('id', item.id)
          if (error) {
            console.error(`Error updating ${item.name}:`, error)
          } else {
            console.log(`✅ Updated inventory item "${item.name}" → 999 шт.`)
          }
        }
      }
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
