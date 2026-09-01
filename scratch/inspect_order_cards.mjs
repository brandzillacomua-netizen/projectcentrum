import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectOrderCards() {
  const { data: orders } = await supabase.from('orders').select('id, order_num, name')
  console.log('Orders:', orders)

  const { data: tasks } = await supabase.from('tasks').select('id, order_id, step, status')
  console.log('\nTasks:', tasks?.length)

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, operation, status, quantity, used_in_shop2_qty')

  orders?.forEach(o => {
    const oTasks = tasks?.filter(t => t.order_id === o.id) || []
    const tIds = new Set(oTasks.map(t => t.id))
    const oCards = cards?.filter(c => tIds.has(c.task_id)) || []
    console.log(`\n========================================`)
    console.log(`ORDER ${o.order_num} (${o.name}) | Tasks: ${oTasks.length} | Cards: ${oCards.length}`)
    console.log(`========================================`)
    oCards.forEach(c => {
      console.log(`  Card ${c.id.slice(-8)} | NomID: ${c.nomenclature_id} | Op: "${c.operation}" | Status: "${c.status}" | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty}`)
    })
  })
}

inspectOrderCards()
