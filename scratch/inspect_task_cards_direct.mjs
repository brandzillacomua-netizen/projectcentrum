import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function inspectTaskCardsDirectly() {
  const { data: tasks } = await supabase.from('tasks').select('id, order_id, step, status, plan_snapshot')
  const { data: cards } = await supabase.from('work_cards').select('id, task_id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, card_info')
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, code')

  const nomMap = {}
  noms?.forEach(n => { nomMap[n.id] = n.name })

  console.log('Total tasks:', tasks?.length)
  console.log('Total cards:', cards?.length)

  // Group cards by task_id
  const cardsByTask = {}
  cards?.forEach(c => {
    if (!cardsByTask[c.task_id]) cardsByTask[c.task_id] = []
    cardsByTask[c.task_id].push(c)
  })

  tasks?.forEach(t => {
    const tCards = cardsByTask[t.id] || []
    if (tCards.length === 0) return
    const activeCards = tCards.filter(c => c.status !== 'completed' && c.status !== 'cancelled')
    if (activeCards.length === 0) return

    console.log(`\n==================================================`)
    console.log(`TASK ID: ${t.id} | Step: "${t.step}" | Status: "${t.status}" | OrderID: ${t.order_id}`)
    console.log(`==================================================`)
    activeCards.forEach(c => {
      const nomName = nomMap[c.nomenclature_id] || c.nomenclature_id
      console.log(`  Card ${c.id.slice(-8)} | Nom: ${nomName} | Op: "${c.operation}" | Status: "${c.status}" | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty}`)
    })
  })
}

inspectTaskCardsDirectly()
