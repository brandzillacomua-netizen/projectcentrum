import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: orders } = await supabase
    .from('orders')
    .select('*')

  const targetOrders = (orders || []).filter(o => o.order_num === '260827-1' || o.order_num === '260820-3')
  console.log('=== TARGET ORDERS ===')
  targetOrders.forEach(o => console.log(`Order ${o.order_num} (id: ${o.id}) Qty: ${o.planned_qty || o.quantity}`))

  const orderIds = targetOrders.map(o => o.id)

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, name, step, status, order_id, plan_snapshot')
    .in('order_id', orderIds)

  console.log('\n=== TASKS & PLAN SNAPSHOTS ===')
  tasks?.forEach(t => {
    console.log(`Task: ${t.name} (order: ${t.order_id})`)
    if (t.plan_snapshot) {
      console.log(JSON.stringify(t.plan_snapshot, null, 2))
    }
  })

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, order_id, quantity, used_in_shop2_qty, status, operation, card_info')
    .in('order_id', orderIds)

  const { data: nomenclatures } = await supabase
    .from('nomenclatures')
    .select('id, name, code')

  const nomMap = new Map((nomenclatures || []).map(n => [n.id, n]))

  console.log('\n=== WORK CARDS SUMMARY ===')
  cards?.forEach(c => {
    const nom = nomMap.get(c.nomenclature_id)
    console.log(`Card ${c.id.substring(0, 8)} | Nom: ${nom?.name} | Qty: ${c.quantity} | Used: ${c.used_in_shop2_qty} | Status: ${c.status} | Op: ${c.operation}`)
  })
}

main().catch(console.error)
