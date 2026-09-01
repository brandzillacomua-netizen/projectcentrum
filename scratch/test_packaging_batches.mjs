import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: bomItems } = await supabase.from('bom_items').select('*')
  const { data: requests } = await supabase.from('material_requests').select('*')

  console.log(`DB Tasks: ${tasks.length}, DB Orders: ${orders.length}`)

  const relevantTasks = tasks.filter(t => {
    if (t.plan_snapshot?._metadata?.is_packaged === true) return false
    return t.status === 'in-progress' || t.status === 'completed' || t.status === 'active' || t.status === 'new'
  })

  console.log(`Relevant Tasks (not packaged, status in-progress/completed/active/new): ${relevantTasks.length}`)

  const batchGroups = {}
  relevantTasks.forEach(task => {
    const order = orders.find(o => o.id === task.order_id)
    if (!order) {
      console.log(`  Task ${task.id} has no order matched (order_id: ${task.order_id})`)
      return
    }
    if (order.status === 'deleted' || order.status === 'cancelled' || order.status === 'shipped') {
      console.log(`  Order ${order.order_num} has excluded status: ${order.status}`)
      return
    }
    if (order.order_num && (order.order_num.startsWith('ВБ') || order.order_num.startsWith('VB'))) return

    let schedule = []
    try {
      const parsed = typeof order.report === 'string' ? JSON.parse(order.report) : (order.report || {})
      schedule = Array.isArray(parsed.batch_schedule) ? parsed.batch_schedule : []
    } catch (e) {}

    if (schedule.length > 0) {
      schedule.forEach(sb => {
        if (sb.packaged === true) return
        const key = `${task.order_id}_sched_${sb.batch_num}`
        if (!batchGroups[key]) {
          batchGroups[key] = { key, orderId: task.order_id, orderNum: order.order_num, tasks: [] }
        }
        batchGroups[key].tasks.push(task)
      })
    } else {
      const bIdx = task.batch_index || ''
      const key = bIdx ? `${task.order_id}_${bIdx}` : `${task.order_id}_whole`
      if (!batchGroups[key]) {
        batchGroups[key] = { key, orderId: task.order_id, orderNum: order.order_num, tasks: [] }
      }
      batchGroups[key].tasks.push(task)
    }
  })

  console.log(`Batch groups generated: ${Object.keys(batchGroups).length}`)
  Object.values(batchGroups).forEach(b => {
    console.log(`  Batch ${b.key} | Order ${b.orderNum} | Tasks: ${b.tasks.length}`)
  })
}

run().catch(console.error)
