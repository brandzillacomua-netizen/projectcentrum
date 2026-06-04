import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function run() {
  // Query all tasks where metadata has is_shipped === true
  const { data, error } = await supabase
    .from('tasks')
    .select('id, order_id, batch_index, plan_snapshot')
  
  if (error) {
    console.error(error)
    return
  }

  const shippedTasks = data.filter(t => t.plan_snapshot?._metadata?.is_shipped === true)
  console.log('Total tasks with is_shipped === true:', shippedTasks.length)

  // Unique batches
  const uniqueBatches = new Set()
  shippedTasks.forEach(t => {
    uniqueBatches.add(`${t.order_id}_${t.batch_index || '1'}`)
  })
  console.log('Total unique shipped batches:', uniqueBatches.size)
}

run()
