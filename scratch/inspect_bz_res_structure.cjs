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

async function checkBzResStructure() {
  const { data: bzRes } = await supabase.from('bz_inventory_reservations').select('*').limit(10)
  console.log("Sample records from bz_inventory_reservations:", JSON.stringify(bzRes, null, 2))

  const { data: allBz } = await supabase.from('bz_inventory_reservations').select('order_id,task_id,created_at')
  const uniqueOrders = new Set(allBz.map(b => b.order_id).filter(Boolean))
  const uniqueTasks = new Set(allBz.map(b => b.task_id).filter(Boolean))
  const nullTasks = allBz.filter(b => !b.task_id).length

  console.log(`\nTotal rows: ${allBz.length}`)
  console.log(`Rows with task_id === null: ${nullTasks}`)
  console.log(`Unique order_ids: ${uniqueOrders.size}`)
  console.log(`Unique task_ids: ${uniqueTasks.size}`)

  // Check if those orders exist
  const { data: orders } = await supabase.from('orders').select('id,order_number,status').in('id', Array.from(uniqueOrders))
  console.log(`Found ${orders?.length || 0} matching orders out of ${uniqueOrders.size}`)
  orders?.forEach(o => console.log(` - Order #${o.order_number} (${o.status}) [${o.id}]`))

  // Check if those tasks exist
  const { data: tasks } = await supabase.from('tasks').select('id,order_num,step,status').in('id', Array.from(uniqueTasks))
  console.log(`Found ${tasks?.length || 0} matching tasks out of ${uniqueTasks.size}`)
  tasks?.forEach(t => console.log(` - Task #${t.order_num} (${t.step}, status: ${t.status}) [${t.id}]`))
}

checkBzResStructure().then(() => process.exit(0))
