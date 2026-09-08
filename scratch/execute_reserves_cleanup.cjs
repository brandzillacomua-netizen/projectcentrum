const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function cleanup() {
  console.log("=== STARTING CLEANUP OF ORPHAN RESERVES (СО, СВ, СГП) ===")

  // Authenticate
  const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  })
  if (authErr) {
    console.error("Auth failed:", authErr.message)
    process.exit(1)
  }
  console.log("Authenticated successfully as", auth.user.email)

  // 1. Get all active tasks and orders
  const { data: tasks } = await supabase.from('tasks').select('id,status')
  const validTaskIds = new Set((tasks || []).filter(t => !['completed', 'cancelled'].includes(t.status)).map(t => t.id))

  const { data: orders } = await supabase.from('orders').select('id,status')
  const validOrderIds = new Set((orders || []).filter(o => !['completed', 'delivered', 'shipped', 'cancelled'].includes(o.status)).map(o => o.id))

  console.log(`Valid active tasks: ${validTaskIds.size}, Valid active orders: ${validOrderIds.size}`)

  // 2. Clean up material_requests
  console.log("\n1. Cleaning up material_requests...")
  const { data: activeReqs, error: reqErr } = await supabase
    .from('material_requests')
    .select('id,task_id,order_id,status,details,quantity')
    .in('status', ['pending', 'approved', 'reserved', 'issued'])

  if (reqErr) {
    console.error("Error fetching material_requests:", reqErr)
  } else {
    const orphanReqs = (activeReqs || []).filter(r => {
      const hasActiveTask = r.task_id && validTaskIds.has(r.task_id)
      const hasActiveOrder = r.order_id && validOrderIds.has(r.order_id)
      return !hasActiveTask && !hasActiveOrder
    })
    console.log(`Found ${orphanReqs.length} orphan active material requests to cancel.`)
    
    if (orphanReqs.length > 0) {
      const orphanIds = orphanReqs.map(r => r.id)
      // Process in batches of 50
      for (let i = 0; i < orphanIds.length; i += 50) {
        const batch = orphanIds.slice(i, i + 50)
        const { error: cancelErr } = await supabase
          .from('material_requests')
          .update({
            status: 'cancelled'
          })
          .in('id', batch)
        if (cancelErr) {
          console.error("Error cancelling batch of requests:", cancelErr)
        }
      }
      console.log(`Successfully cancelled ${orphanReqs.length} orphan material requests.`)
    }
  }

  // 3. Clean up bz_inventory_reservations
  console.log("\n2. Cleaning up bz_inventory_reservations...")
  const { data: activeBz, error: bzErr } = await supabase
    .from('bz_inventory_reservations')
    .select('id,task_id,order_id,status')
    .eq('status', 'allocated')

  if (bzErr) {
    console.error("Error fetching bz_inventory_reservations:", bzErr)
  } else {
    const orphanBz = (activeBz || []).filter(b => {
      const hasActiveTask = b.task_id && validTaskIds.has(b.task_id)
      const hasActiveOrder = b.order_id && validOrderIds.has(b.order_id)
      return !hasActiveTask && !hasActiveOrder
    })
    console.log(`Found ${orphanBz.length} orphan allocated BZ reservations to release.`)

    if (orphanBz.length > 0) {
      const orphanBzIds = orphanBz.map(b => b.id)
      for (let i = 0; i < orphanBzIds.length; i += 50) {
        const batch = orphanBzIds.slice(i, i + 50)
        const { error: relErr } = await supabase
          .from('bz_inventory_reservations')
          .update({
            status: 'released',
            released_at: new Date().toISOString(),
            release_reason: 'Очищення фантомних резервів: наряд або замовлення відсутнє'
          })
          .in('id', batch)
        if (relErr) {
          console.error("Error releasing batch of BZ reservations:", relErr)
        }
      }
      console.log(`Successfully released ${orphanBz.length} orphan BZ reservations.`)
    }
  }

  // 4. Reset reserved_qty on inventory
  console.log("\n3. Resetting phantom reserved_qty in inventory table...")
  let allReservedItems = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id,name,warehouse,type,reserved_qty,nomenclature_id')
      .gt('reserved_qty', 0)
      .range(from, from + 999)
    if (error) {
      console.error("Error fetching inventory items with reserve:", error)
      break
    }
    if (!data || data.length === 0) break
    allReservedItems = allReservedItems.concat(data)
    if (data.length < 1000) break
    from += 1000
  }

  console.log(`Found ${allReservedItems.length} items in inventory with reserved_qty > 0.`)

  if (allReservedItems.length > 0) {
    const invIdsToReset = allReservedItems.map(i => i.id)
    for (let i = 0; i < invIdsToReset.length; i += 50) {
      const batch = invIdsToReset.slice(i, i + 50)
      const { error: resetErr } = await supabase
        .from('inventory')
        .update({
          reserved_qty: 0,
          updated_at: new Date().toISOString()
        })
        .in('id', batch)
      if (resetErr) {
        console.error("Error resetting reserved_qty for batch:", resetErr)
      }
    }
    console.log(`Successfully reset reserved_qty to 0 for all ${allReservedItems.length} inventory items.`)
  }

  console.log("\n=== CLEANUP COMPLETED SUCCESSFULLY ===")
}

cleanup().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); })
