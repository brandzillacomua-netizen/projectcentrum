import { createClient } from '@supabase/supabase-js'

const url = 'https://hurzutjytlcvtbvihnry.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(url, key)

async function main() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' })

  const { data: req } = await supabase
    .from('material_requests')
    .select('*')
    .eq('id', 'fb1dbe01-a371-4837-a69e-447696cdb2e5')
    .single()

  console.log('Request fb1dbe01:', req)

  if (req?.task_id) {
    const { data: task } = await supabase.from('tasks').select('*').eq('id', req.task_id).single()
    console.log('Task for this request:', {
      id: task?.id,
      order_id: task?.order_id,
      step: task?.step,
      planned_sets: task?.planned_sets,
      plan_snapshot: task?.plan_snapshot
    })
  }
}

main().catch(console.error)
