import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const ordersMap = Object.fromEntries(orders.map(o => [o.id, o]))
  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))

  const kyivNom = nomenclatures.find(n => n.name === 'Київ К-ІП9-10-П-7-46')
  console.log(`Київ К-ІП9-10-П-7-46 id: ${kyivNom?.id}`)

  // ALL flow_totals for this nom WITHOUT limit
  const { data: flowAll, error: fe } = await supabase
    .from('flow_totals')
    .select('*')
    .eq('nomenclature_id', kyivNom?.id)
  console.log(`flow_totals count: ${flowAll?.length || 0}, error: ${fe?.message || 'none'}`)
  if (flowAll?.length) {
    flowAll.forEach(r => {
      const o = ordersMap[tasks.find(t => t.id === r.task_id)?.order_id]
      console.log(`  task=${r.task_id?.slice(-8)} | order=${o?.order_num} | stage=${r.stage} | total_good=${r.total_good} | total_bz=${r.total_bz}`)
    })
  }

  // ALL work_cards for Київ К
  const { data: kyivCards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('nomenclature_id', kyivNom?.id)
  console.log(`\nAll work_cards for Київ К (${kyivCards?.length || 0}):`)
  kyivCards?.forEach(c => {
    const o = ordersMap[tasks.find(t => t.id === c.task_id)?.order_id]
    console.log(`  ${c.id.slice(-8)} | Op: ${c.operation} | Status: ${c.status} | Qty: ${c.quantity} | Order: ${o?.order_num}`)
  })

  // Check what demandForParent would be for Рама F10
  const parentF10 = nomenclatures.find(n => n.name === 'Рама F10')
  const parentIdF10 = String(parentF10?.id)
  console.log(`\nРама F10 id: ${parentIdF10}`)

  // Active filter tasks for 260826-1
  const order26 = orders.find(o => o.order_num === '260826-1')
  console.log(`Order 260826-1 id: ${order26?.id}`)
  const tasks26 = tasks.filter(t => t.order_id === order26?.id)
  console.log(`Tasks for 260826-1 (${tasks26.length}):`)
  tasks26.forEach(t => {
    const snap = t.plan_snapshot?.[kyivNom?.id]
    console.log(`  ${t.id.slice(-8)} | step: ${t.step} | status: ${t.status} | planned_sets: ${t.planned_sets} | w_conf: ${t.warehouse_conf} | eng_conf: ${t.engineer_conf} | dir_conf: ${t.director_conf}`)
    console.log(`    snap[KyivK]: ${snap ? `stock=${snap.stock}, need=${snap.need}, sheets=${snap.sheets}, ups=${snap.units_per_sheet}` : 'none'}`)
  })

  // Active filter for 260827-2
  const order272 = orders.find(o => o.order_num === '260827-2')
  const tasks272 = tasks.filter(t => t.order_id === order272?.id)
  console.log(`\nTasks for 260827-2 (${tasks272.length}):`)
  tasks272.forEach(t => {
    const snap = t.plan_snapshot?.[kyivNom?.id]
    console.log(`  ${t.id.slice(-8)} | step: ${t.step} | status: ${t.status} | planned_sets: ${t.planned_sets}`)
    if (snap) console.log(`    snap[KyivK]: stock=${snap.stock}, need=${snap.need}, sheets=${snap.sheets}, ups=${snap.units_per_sheet}`)
  })

  // What filterTaskIds would include (the "active" laser tasks)
  const activeTasks = tasks.filter(t => {
    const hasActiveShop2 = tasks.some(s =>
      s.order_id === t.order_id && s.batch_index === t.batch_index &&
      (s.step?.includes('Пресування') || s.step?.includes('ЦЕХ №2') || s.step?.includes('Доопрацювання')) &&
      s.status !== 'completed'
    )
    const isLaser = (t.step || '').toLowerCase().includes('розкрій')
    const confirmed = (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf
    return confirmed && isLaser && (t.status !== 'completed' || hasActiveShop2)
  })
  const filterTaskIds = activeTasks.map(t => t.id)
  const orderIds = [...new Set(activeTasks.map(t => t.order_id).filter(Boolean))]
  const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))

  // Build taskParentMap
  const taskParentMap = {}
  allTasksForOrders.forEach(task => {
    const order = ordersMap[task.order_id]
    if (!order) return
    let pId = order.nomenclature_id || order.order_items?.[0]?.nomenclature_id
    if (!pId) return
    taskParentMap[task.id] = String(pId)
  })

  // demandForParent for Рама F10 with Київ К
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  // Find qtyPerProduct from snapshot
  let qtyPerProduct = 1
  allTasksForOrders.forEach(task => {
    const order = ordersMap[task.order_id]
    if (!order) return
    let pId = order.nomenclature_id || order.order_items?.[0]?.nomenclature_id
    if (!pId || String(pId) !== parentIdF10) return
    if (task.plan_snapshot && Object.keys(task.plan_snapshot).some(k => uuidRegex.test(k))) {
      const snap = task.plan_snapshot[kyivNom?.id]
      if (snap) {
        const planned = Number(task.planned_sets) || 1
        const need = Number(snap.need) || 0
        qtyPerProduct = planned > 0 ? Math.round(need / planned) : need
        console.log(`\nqtyPerProduct from task ${task.id.slice(-8)}: need=${need}, planned=${planned} → ${qtyPerProduct}`)
      }
    }
  })

  let dF10 = 0
  filterTaskIds.forEach(taskId => {
    if (taskParentMap[taskId] !== parentIdF10) return
    const task = tasks.find(t => t.id === taskId)
    const ps = Number(task?.planned_sets) || 0
    console.log(`  filterTask ${taskId.slice(-8)} contributes planned_sets=${ps}`)
    dF10 += ps
  })
  const demandF10 = dF10 * qtyPerProduct
  console.log(`\ndemandForParent for Рама F10 (Київ К) = ${dF10} × ${qtyPerProduct} = ${demandF10}`)
}

run().catch(console.error)
