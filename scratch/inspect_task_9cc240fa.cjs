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

async function run() {
  console.log("=== INSPECTING TASK 9cc240fa AND 431a8621 ===")
  const { data: tasks } = await supabase.from('tasks').select('*').in('id', ['f3004d89-c3d1-41c4-b6d0-ce373cb4cb15', '431a8621-f5fb-4e64-ad6e-41d16f0ea769', 'e4a08947-1d8c-49ff-a5d9-2fb563eef1d3'])
  console.log("Tasks found:", tasks?.length)
  tasks?.forEach(t => {
    console.log("\nTASK:", t.id)
    console.log("order_id:", t.order_id)
    console.log("batch_index:", t.batch_index)
    console.log("plan_snapshot keys:", Object.keys(t.plan_snapshot || {}))
    console.log("_metadata:", t.plan_snapshot?._metadata)
  })

  // Also query task by partial ID 9cc240fa
  const { data: match9cc } = await supabase.from('tasks').select('*').ilike('id', '%9cc240fa%')
  console.log("\nMatch 9cc240fa:", match9cc?.length)
  match9cc?.forEach(t => {
    console.log("ID:", t.id)
    console.log("order_id:", t.order_id)
    console.log("batch_index:", t.batch_index)
    console.log("plan_snapshot._metadata:", t.plan_snapshot?._metadata)
  })

  // If order_id exists, fetch order!
  if (match9cc?.[0]?.order_id) {
    const { data: ord } = await supabase.from('orders').select('*').eq('id', match9cc[0].order_id)
    console.log("\nORDER for 9cc240fa:", ord)
  }
}

run()
