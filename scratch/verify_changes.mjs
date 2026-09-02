import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  
  // Pending tasks filter logic matching DirectorModule.jsx
  const pendingTasks = tasks.filter(t => 
    t.status !== 'completed' && t.status !== 'cancelled' && 
    (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && 
    t.engineer_conf === true && 
    !t.director_conf
  )

  console.log(`=== PENDING DIRECTOR APPROVAL TASKS (${pendingTasks.length}) ===`)
  pendingTasks.forEach(t => {
    console.log(`Task ID: ${t.id} | Step: ${t.step} | Status: ${t.status} | OrderID: ${t.order_id}`)
  })
}

main().catch(console.error)
