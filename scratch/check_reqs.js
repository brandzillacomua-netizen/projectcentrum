import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkReqs() {
  const taskIds = [
    'c54c9af2-bcc6-4fc7-8e61-9b287e30f53a',
    'e0104faa-0298-4c9b-a02c-507fdd6219b6',
    'ae8104c8-d237-42df-bf3c-62e589b7252b'
  ]
  
  for (const id of taskIds) {
    const { data: task } = await supabase.from('tasks').select('*').eq('id', id).single()
    const { data: order } = await supabase.from('orders').select('order_num, customer').eq('id', task.order_id).single()
    console.log(`\nTask ID: ${id}`)
    console.log(`- Step: ${task.step}, Status: ${task.status}`)
    console.log(`- Order: #${order?.order_num} for ${order?.customer}`)
    
    const { data: reqs } = await supabase.from('material_requests').select('*').eq('task_id', id)
    console.log(`- Material Requests count: ${reqs?.length || 0}`)
    reqs?.forEach(r => {
      console.log(`  * Request ID: ${r.id}, Qty: ${r.quantity}, Details: ${r.details}`)
    })
  }
}

checkReqs()
