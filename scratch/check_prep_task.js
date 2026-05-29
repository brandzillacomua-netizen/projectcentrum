import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('step', 'Підготовка')
    .order('created_at', { ascending: false })
    .limit(5)

  console.log("=== Recent Preparation Tasks ===")
  for (const t of tasks || []) {
    console.log(`Task ID: ${t.id} | Status: ${t.status} | Good: ${t.good_qty} | Scrap: ${t.scrap_qty} | Created: ${t.created_at}`)
    console.log(`Snapshot:`, JSON.stringify(t.plan_snapshot, null, 2))

    // Check material requests for this task
    const { data: reqs } = await supabase
      .from('material_requests')
      .select('*')
      .eq('task_id', t.id)
    
    console.log(`Material requests for task:`)
    for (const r of reqs || []) {
      console.log(`- Req ID: ${r.id} | Nom ID: ${r.nomenclature_id} | Qty: ${r.quantity} | Status: ${r.status} | Details: "${r.details}"`)
    }
    console.log("-----------------------------------------")
  }
}

run()
