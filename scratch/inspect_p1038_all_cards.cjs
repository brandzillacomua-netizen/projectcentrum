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
  console.log("=== INSPECTING ALL CARDS & TASKS FOR F415-ІП27-П-10-38 ===")
  const nomId = '4a4aba71-4865-45f8-a0d0-fc387f9b92eb'

  // 1. Search all work_cards for this nomenclature_id
  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('nomenclature_id', nomId)

  console.log(`Total work cards for nomenclature across whole DB: ${cards?.length}`)
  cards?.forEach(c => {
    console.log(`Card #${c.id.slice(-8)} | task_id: ${c.task_id} | order_id: ${c.order_id} | qty: ${c.quantity} | op: ${c.operation} | status: ${c.status} | info: "${c.card_info}" | is_rework: ${c.is_rework}`)
  })

  // 2. Search all tasks for order_id or order_num '260825-2'
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')

  const matchingTasks = tasks?.filter(t => {
    return String(t.id).includes('260825-2') || JSON.stringify(t.plan_snapshot || {}).includes(nomId)
  })

  console.log(`\nMatching tasks count: ${matchingTasks?.length}`)
  matchingTasks?.forEach(t => {
    console.log(`Task ${t.id} | step: ${t.step} | status: ${t.status} | order_id: ${t.order_id} | is_rework: ${t.is_rework}`)
  })
}

run()
