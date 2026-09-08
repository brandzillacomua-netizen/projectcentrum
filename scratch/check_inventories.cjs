const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://hurzutjytlcvtbvihnry.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function checkInventories() {
  console.log("=== CHECKING WAREHOUSE TABLES INVENTORIES ===")

  // 1. inventory (SO & SV)
  const { data: inv } = await supabase.from('inventory').select('id,name,warehouse,total_qty,reserved_qty,unit')
  console.log(`\nTable 'inventory' (СО/СВ) total items: ${inv?.length || 0}`)
  const invWithReserve = inv?.filter(i => Number(i.reserved_qty) > 0) || []
  console.log(`Items with reserved_qty > 0: ${invWithReserve.length}`)
  invWithReserve.forEach(i => console.log(` - [${i.warehouse}] ${i.name}: reserved=${i.reserved_qty}/${i.total_qty} ${i.unit}`))

  // 2. warehouse_fgp_inventory (SGP)
  const { data: fgp } = await supabase.from('warehouse_fgp_inventory').select('id,name,type,total_qty,reserved_qty,unit')
  console.log(`\nTable 'warehouse_fgp_inventory' (СГП) total items: ${fgp?.length || 0}`)
  const fgpWithReserve = fgp?.filter(i => Number(i.reserved_qty) > 0) || []
  console.log(`Items with reserved_qty > 0: ${fgpWithReserve.length}`)
  fgpWithReserve.forEach(i => console.log(` - [${i.type}] ${i.name}: reserved=${i.reserved_qty}/${i.total_qty} ${i.unit}`))

  // 3. material_requests
  const { data: mReqs } = await supabase.from('material_requests').select('id,order_num,task_id,status,material_name,quantity')
  console.log(`\nTable 'material_requests' total rows: ${mReqs?.length || 0}`)
  const activeMReqs = mReqs?.filter(r => !['completed', 'cancelled', 'rejected'].includes(r.status)) || []
  console.log(`Active / non-final material_requests: ${activeMReqs.length}`)
  activeMReqs.forEach(r => console.log(` - Req ${r.id}: ${r.material_name} (${r.quantity}) [${r.status}] order: ${r.order_num}, task: ${r.task_id}`))

  // 4. work_cards
  const { data: wCards } = await supabase.from('work_cards').select('id,order_id,task_id,status,operation')
  console.log(`\nTable 'work_cards' total rows: ${wCards?.length || 0}`)
  const activeWCards = wCards?.filter(c => c.status !== 'completed' && c.status !== 'archived') || []
  console.log(`Active work_cards: ${activeWCards.length}`)

  // 5. bz_inventory_reservations
  const { data: bzRes } = await supabase.from('bz_inventory_reservations').select('id,status,requested_qty,allocated_qty,nomenclature_id')
  console.log(`\nTable 'bz_inventory_reservations' total rows: ${bzRes?.length || 0}`)
  const allocatedBz = bzRes?.filter(b => b.status === 'allocated') || []
  console.log(`Allocated (active reservations) in bz_inventory_reservations: ${allocatedBz.length}`)
  const totalAllocatedQty = allocatedBz.reduce((s, b) => s + Number(b.allocated_qty || b.requested_qty || 0), 0)
  console.log(`Total phantom quantity reserved by allocated BZ: ${totalAllocatedQty}`)
}

checkInventories().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
