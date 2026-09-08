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

async function checkAll() {
  console.log("=== CHECKING CURRENT ACTIVE TASKS & ORDERS ===")
  const { data: tasks } = await supabase.from('tasks').select('id,order_id,order_num,step,status,machine_name,warehouse_conf,created_at')
  console.log(`Current tasks in system: ${tasks?.length || 0}`)
  tasks?.forEach(t => {
    console.log(`Task ${t.id.slice(0,8)} | Order: ${t.order_num || t.order_id} | Step: ${t.step} | Status: ${t.status} | WH_Conf: ${t.warehouse_conf} | Created: ${t.created_at}`)
  })

  const { data: orders } = await supabase.from('orders').select('id,order_number,status,client_name,created_at')
  console.log(`\nCurrent orders in system: ${orders?.length || 0}`)
  orders?.forEach(o => {
    console.log(`Order ${o.order_number} | Status: ${o.status} | Client: ${o.client_name} | Created: ${o.created_at}`)
  })

  // Check any reservations in warehouse_fgp_reservations
  const { data: fgpRes, error: fErr } = await supabase.from('warehouse_fgp_reservations').select('*')
  if (!fErr) {
    console.log(`\nwarehouse_fgp_reservations: ${fgpRes?.length || 0}`)
    fgpRes?.forEach(r => console.log(r))
  } else {
    console.log("warehouse_fgp_reservations does not exist or error:", fErr.message)
  }

  // Check warehouse_material_reservations
  const { data: matRes, error: mErr } = await supabase.from('warehouse_material_reservations').select('*')
  if (!mErr) {
    console.log(`\nwarehouse_material_reservations: ${matRes?.length || 0}`)
    matRes?.forEach(r => console.log(r))
  } else {
    console.log("warehouse_material_reservations error:", mErr.message)
  }

  // Check any other tables with "reserv" in their name from information_schema if possible or RPC
}

checkAll().then(() => process.exit(0)).catch(err => {
  console.error(err)
  process.exit(1)
})
