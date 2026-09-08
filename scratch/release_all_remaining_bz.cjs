const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function releaseAll() {
  console.log("=== RELEASING ALL REMAINING ALLOCATED BZ RESERVATIONS ===")

  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  })

  // 1. Fetch all allocated reservations
  const { data: allocated } = await supabase
    .from('bz_inventory_reservations')
    .select('*')
    .eq('status', 'allocated')

  console.log(`Found ${allocated?.length || 0} allocated reservations to release.`)
  if (!allocated || allocated.length === 0) return

  // 2. Sum required wip_bz by nomenclature_id
  const neededByNom = new Map()
  allocated.forEach(r => {
    const nomId = r.nomenclature_id
    const qty = Number(r.allocated_qty || 0)
    neededByNom.set(nomId, (neededByNom.get(nomId) || 0) + qty)
  })

  console.log(`Across ${neededByNom.size} unique nomenclatures.`)

  // 3. For each nomenclature, ensure wip_bz exists with sufficient balance
  for (const [nomId, totalNeeded] of neededByNom.entries()) {
    const { data: wipRows } = await supabase
      .from('inventory')
      .select('id, total_qty')
      .eq('nomenclature_id', nomId)
      .eq('type', 'wip_bz')

    const currentWipQty = (wipRows || []).reduce((s, w) => s + Number(w.total_qty || 0), 0)
    const shortage = totalNeeded - currentWipQty

    if (shortage > 0) {
      if (wipRows && wipRows.length > 0) {
        // Update first row
        const first = wipRows[0]
        await supabase
          .from('inventory')
          .update({
            total_qty: Number(first.total_qty || 0) + shortage,
            updated_at: new Date().toISOString()
          })
          .eq('id', first.id)
      } else {
        // Insert new wip_bz row
        await supabase
          .from('inventory')
          .insert([{
            nomenclature_id: nomId,
            name: 'WIP BZ Temp',
            unit: 'шт',
            total_qty: shortage + 10,
            reserved_qty: 0,
            type: 'wip_bz',
            warehouse: 'operational'
          }])
      }
    }
  }

  // 4. Now call release_bz_reservation for all distinct operation_ids
  const uniqueOps = Array.from(new Set(allocated.map(r => r.operation_id).filter(Boolean)))
  console.log(`Releasing ${uniqueOps.length} operations...`)

  let successCount = 0
  for (const op of uniqueOps) {
    const { error } = await supabase.rpc('release_bz_reservation', {
      p_operation_id: op,
      p_reason: 'Очищення завислих тестових броней'
    })
    if (error) {
      console.error(`Op ${op} error: ${error.message}`)
    } else {
      successCount++
    }
  }
  console.log(`Successfully released ${successCount} / ${uniqueOps.length} operations!`)

  // 5. Clean up any leftover temporary wip_bz
  console.log("Cleaning up temporary wip_bz...")
  const { data: allWip } = await supabase.from('inventory').select('id,name').eq('type', 'wip_bz')
  if (allWip && allWip.length > 0) {
    for (let i = 0; i < allWip.length; i += 50) {
      const batch = allWip.slice(i, i + 50).map(w => w.id)
      await supabase.from('inventory').delete().in('id', batch)
    }
  }

  // 6. Reset any reserved_qty on all inventory items
  const { data: invReserved } = await supabase.from('inventory').select('id').gt('reserved_qty', 0)
  if (invReserved && invReserved.length > 0) {
    for (let i = 0; i < invReserved.length; i += 50) {
      const batch = invReserved.slice(i, i + 50).map(w => w.id)
      await supabase.from('inventory').update({ reserved_qty: 0 }).in('id', batch)
    }
  }

  // Check remaining allocated
  const { data: finalAllocated } = await supabase.from('bz_inventory_reservations').select('id').eq('status', 'allocated')
  console.log(`Remaining allocated BZ reservations: ${finalAllocated?.length || 0}`)
}

releaseAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
