import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = '99190e0a-91b0-4a44-ab5e-b1a1ec393ffe'
  console.log('Cleaning up material_requests for task:', taskId)

  const { data: deleted, error } = await supabase
    .from('material_requests')
    .delete()
    .eq('task_id', taskId)
    .eq('status', 'pending')
    .select()

  if (error) {
    console.error('Error deleting pending material_requests:', error)
  } else {
    console.log(`✅ Deleted ${deleted?.length || 0} material_requests for task ${taskId}`)
  }
}

main().catch(console.error)
