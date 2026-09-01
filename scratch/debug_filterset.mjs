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

  // Build active filter tasks (same as ForemanDashboardModule)
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
  const orderIds = Array.from(new Set(activeTasks.map(t => t.order_id).filter(Boolean)))
  const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))
  const filterSet = new Set(allTasksForOrders.map(t => t.id))

  console.log(`filterTaskIds: ${filterTaskIds.length}`)
  console.log(`orderIds: ${orderIds.map(oid => ordersMap[oid]?.order_num).join(', ')}`)
  console.log(`allTasksForOrders: ${allTasksForOrders.length}`)
  console.log(`filterSet size: ${filterSet.size}`)

  // Check if any task from 31072026-01, 07082026-03, 26072026-01 is in filterSet
  const checkOrders = ['31072026-01', '07082026-03', '26072026-01', '15072026-01', '23072026-01', '27072026-03', '07072026-01', '27062026-01']
  for (const orderNum of checkOrders) {
    const o = orders.find(x => x.order_num === orderNum)
    if (!o) continue
    const ots = tasks.filter(t => t.order_id === o.id)
    const inFilter = ots.filter(t => filterSet.has(t.id))
    if (inFilter.length > 0) {
      console.log(`\n!!! ${orderNum} tasks IN filterSet: ${inFilter.map(t => t.id.slice(-8)).join(', ')}`)
      inFilter.forEach(t => {
        const parentNom = nomMap.get(o.nomenclature_id || o.order_items?.[0]?.nomenclature_id)
        console.log(`   ${t.id.slice(-8)} | step: ${t.step} | parentNom: ${parentNom?.name}`)
      })
    }
  }

  // Now: which Пакування/СГП cards for Київ К are in filteredCards?
  const kyivNom = nomenclatures.find(n => n.name === 'Київ К-ІП9-10-П-7-46')
  const { data: kyivCards } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, operation, status, quantity')
    .eq('nomenclature_id', kyivNom?.id)

  console.log(`\nПакування/СГП cards for Київ К that ARE in filterSet:`)
  let completedShop2Total = 0
  const shop2ops = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп']
  kyivCards.filter(c => filterSet.has(c.task_id)).forEach(c => {
    const op = (c.operation || '').toLowerCase()
    const isShop2 = shop2ops.some(o => op.includes(o))
    const order = ordersMap[tasks.find(t => t.id === c.task_id)?.order_id]
    if (isShop2 && c.status === 'completed') {
      completedShop2Total += Number(c.quantity) || 0
      console.log(`  ${c.id.slice(-8)} | ${c.operation} | ${c.status} | Qty: ${c.quantity} | order: ${order?.order_num}`)
    }
  })
  console.log(`\nTotal completedShop2Qty for Київ К (in filterSet, no taskParent filter): ${completedShop2Total}`)

  // With taskParentMap F10 filter
  const taskParentMap = {}
  allTasksForOrders.forEach(task => {
    const o = ordersMap[task.order_id]
    if (!o) return
    const pId = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
    if (pId) taskParentMap[task.id] = String(pId)
  })
  const parentF10 = nomenclatures.find(n => n.name === 'Рама F10')
  const parentIdF10 = String(parentF10?.id)
  let completedShop2F10 = 0
  kyivCards.filter(c => {
    if (!filterSet.has(c.task_id)) return false
    if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentIdF10) return false
    const op = (c.operation || '').toLowerCase()
    return shop2ops.some(o => op.includes(o)) && c.status === 'completed'
  }).forEach(c => {
    completedShop2F10 += Number(c.quantity) || 0
    const order = ordersMap[tasks.find(t => t.id === c.task_id)?.order_id]
    console.log(`  F10-filtered shop2: ${c.id.slice(-8)} | ${c.operation} | Qty: ${c.quantity} | order: ${order?.order_num} | taskParent: ${nomMap.get(taskParentMap[c.task_id])?.name}`)
  })
  console.log(`completedShop2Qty for F10 (with taskParentMap filter): ${completedShop2F10}`)

  // Calculate totalPotentialSgp
  const orderTasksF10Fixed = tasks.filter(t => {
    if (!t.order_id || !orderIds.includes(t.order_id)) return false
    const o = ordersMap[t.order_id]
    if (!o) return false
    const oPid = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
    return String(oPid) === parentIdF10
  })
  const ordersF10 = [...new Set(orderTasksF10Fixed.map(t => t.order_id))]
  let initialStockF10 = 0
  ordersF10.forEach(oid => {
    const tw = orderTasksF10Fixed.find(t => t.order_id === oid && t.plan_snapshot?.[kyivNom?.id])
    if (tw) {
      initialStockF10 += Number(tw.plan_snapshot[kyivNom?.id]?.stock) || 0
    }
  })
  console.log(`\ninitialStockF10 = ${initialStockF10}`)
  console.log(`totalPotentialSgp = ${completedShop2F10 + initialStockF10}`)
}

run().catch(console.error)
