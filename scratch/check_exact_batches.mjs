import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function checkExactBatches() {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, order_id, status, step, batch_index, planned_sets, created_at, completed_at, plan_snapshot')
    .in('status', ['in-progress', 'active', 'new', 'completed'])
    .limit(500)

  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_num, status, customer, report, order_items(id, nomenclature_id, quantity)')

  const ordersMap = new Map((orders || []).map(o => [o.id, o]))

  const relevantTasks = (tasks || []).filter(t => {
    if (t.plan_snapshot?._metadata?.is_packaged === true) return false
    return t.status === 'in-progress' || t.status === 'completed' || t.status === 'active' || t.status === 'new'
  })

  const batchGroups = {}
  relevantTasks.forEach(task => {
    const order = ordersMap.get(task.order_id)
    if (!order || order.status === 'deleted' || order.status === 'cancelled' || order.status === 'shipped') return
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
          batchGroups[key] = {
            key,
            orderNum: order.order_num,
            batchIndex: `П${sb.batch_num}`,
            tasks: []
          }
        }
        if (!batchGroups[key].tasks.some(t => t.id === task.id)) {
          batchGroups[key].tasks.push(task)
        }
      })
    } else {
      const bIdx = task.batch_index || ''
      const key = bIdx ? `${task.order_id}_${bIdx}` : `${task.order_id}_whole`
      if (!batchGroups[key]) {
        batchGroups[key] = { key, orderNum: order.order_num, batchIndex: bIdx, tasks: [] }
      }
      if (!batchGroups[key].tasks.some(t => t.id === task.id)) {
        batchGroups[key].tasks.push(task)
      }
    }
  })

  const list = Object.values(batchGroups)
  console.log(`Усього батчів на пакуванні: ${list.length}`)
  list.forEach((b, i) => {
    const steps = b.tasks.map(t => t.step).join(', ')
    console.log(`${i+1}. № ${b.orderNum} ${b.batchIndex ? `/${b.batchIndex}` : ''} | steps: [${steps}] | tasksCount: ${b.tasks.length}`)
  })
}

checkExactBatches().catch(console.error)
