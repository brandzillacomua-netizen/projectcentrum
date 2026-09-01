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
  const { data: tasks } = await supabase.from('tasks').select('*')
  console.log("Total tasks:", tasks?.length)

  const t9cc = tasks?.find(t => t.id.startsWith('9cc240fa') || t.id.includes('9cc240fa'))
  console.log("\nFound 9cc240fa task:")
  console.log("ID:", t9cc?.id)
  console.log("order_id:", t9cc?.order_id)
  console.log("batch_index:", t9cc?.batch_index)
  console.log("step:", t9cc?.step)
  console.log("plan_snapshot._metadata:", t9cc?.plan_snapshot?._metadata)
  console.log("plan_snapshot keys:", Object.keys(t9cc?.plan_snapshot || {}))

  if (t9cc?.order_id) {
    const { data: ord } = await supabase.from('orders').select('*').eq('id', t9cc.order_id)
    console.log("\nOrder for 9cc240fa:", ord)
  }

  const t431a = tasks?.find(t => t.id.startsWith('431a8621') || t.order_id === '431a8621-f5fb-4e64-ad6e-41d16f0ea769')
  console.log("\nFound 431a task:")
  console.log("ID:", t431a?.id)
  console.log("order_id:", t431a?.order_id)
  console.log("batch_index:", t431a?.batch_index)
  console.log("plan_snapshot._metadata:", t431a?.plan_snapshot?._metadata)

  if (t431a?.order_id) {
    const { data: ord } = await supabase.from('orders').select('*').eq('id', t431a.order_id)
    console.log("\nOrder for 431a:", ord)
  }
}

run()
