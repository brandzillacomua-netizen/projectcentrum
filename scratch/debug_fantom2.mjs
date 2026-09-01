import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function run() {
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: bomItems } = await supabase.from('bom_items').select('*')
  const { data: flowTotals } = await supabase.from('flow_totals').select('*').limit(1000)

  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))
  const ordersMap = Object.fromEntries(orders.map(o => [o.id, o]))
  const tasksMap = Object.fromEntries(tasks.map(t => [t.id, t]))

  // Replicate the EXACT buildWipGroups logic from ForemanDashboardModule
  // to find the ACTUAL active tasks used

  // Step 1: find active tasks (same logic as useForemanDashboard)
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

  console.log('Active tasks (shop1 Розкрій confirmed):')
  activeTasks.forEach(t => {
    const o = ordersMap[t.order_id]
    const pNom = nomMap.get(o?.nomenclature_id)
    console.log(`  ${t.id.slice(-8)} | Order: ${o?.order_num} | Parent: ${pNom?.name}`)
  })

  const filterTaskIds = activeTasks.map(t => t.id)
  const selectedTasks = tasks.filter(t => filterTaskIds.includes(t.id))
  const orderIds = Array.from(new Set(selectedTasks.map(t => t.order_id).filter(Boolean)))
  const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))
  const filterSet = new Set(allTasksForOrders.map(t => t.id))
  const filteredCards = cards.filter(c => c.task_id && filterSet.has(c.task_id))

  // Build taskParentMap
  const taskParentMap = {}
  allTasksForOrders.forEach(task => {
    const order = ordersMap[task.order_id]
    if (!order) return
    let pId = order.nomenclature_id || order.order_items?.[0]?.nomenclature_id
    if (!pId) return
    taskParentMap[task.id] = String(pId)
  })

  // ====== CASE 1: KF-Пластинка-3-162 under Рама (інд.проект 27) ======
  const parentNom27 = nomenclatures.find(n => n.name.includes('інд.проект 27'))
  const kfNom = nomenclatures.find(n => n.name === 'KF-Пластинка-3-162')
  console.log('\n\n====== KF-Пластинка-3-162 under Рама (інд.проект 27) ======')
  console.log(`Parent: ${parentNom27?.name} (${parentNom27?.id})`)
  console.log(`Child: ${kfNom?.name} (${kfNom?.id})`)

  const parentId27 = String(parentNom27?.id)

  // Orders for this parent
  const parentOrders27 = orders.filter(o => {
    const p = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
    return String(p) === parentId27
  })
  console.log(`Orders for parent: ${parentOrders27.map(o => `${o.order_num}(${o.id.slice(-8)})`).join(', ')}`)

  // orderTasks filtered by parentId (NEW FIX)
  const orderTasksFixed = tasks.filter(t => {
    if (!t.order_id || !orderIds.includes(t.order_id)) return false
    const o = ordersMap[t.order_id]
    if (!o) return false
    const oPid = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
    return String(oPid) === parentId27
  })
  console.log(`orderTasks (filtered by parentId): ${orderTasksFixed.length} tasks`)
  orderTasksFixed.forEach(t => {
    const o = ordersMap[t.order_id]
    const snap = t.plan_snapshot?.[kfNom?.id]
    console.log(`  Task ${t.id.slice(-8)} | Order: ${o?.order_num} | snap[KF]: stock=${snap?.stock}, need=${snap?.need}`)
  })

  // ordersWithTasks
  const ordersWithTasks27 = Array.from(new Set(orderTasksFixed.map(t => t.order_id)))
  console.log(`ordersWithTasks: ${ordersWithTasks27.map(oid => ordersMap[oid]?.order_num).join(', ')}`)

  let initialStock27 = 0, plannedReserve27 = 0
  ordersWithTasks27.forEach(oid => {
    const taskWithSnap = orderTasksFixed.find(t => t.order_id === oid && t.plan_snapshot && t.plan_snapshot[String(kfNom?.id)])
    if (taskWithSnap) {
      const snapEntry = taskWithSnap.plan_snapshot[String(kfNom?.id)] || {}
      const stock = Number(snapEntry.stock) || 0
      const sheets = Number(snapEntry.sheets) || 0
      const units = Number(snapEntry.units_per_sheet) || 1
      const need = Number(snapEntry.need) || 0
      console.log(`  Order ${ordersMap[oid]?.order_num}: stock=${stock}, sheets=${sheets}, units=${units}, need=${need}`)
      initialStock27 += stock
      plannedReserve27 += Math.max(0, (sheets * units) + stock - need)
    }
  })
  console.log(`initialStock27 = ${initialStock27}, plannedReserve27 = ${plannedReserve27}`)

  // BZ cards for KF-Пластинка under parent 27
  const bzCards27 = filteredCards.filter(c => {
    if (String(c.nomenclature_id) !== String(kfNom?.id)) return false
    if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId27) return false
    return true
  })
  console.log(`BZ/WIP cards for KF under parent 27: ${bzCards27.length}`)
  bzCards27.forEach(c => {
    const o = ordersMap[tasksMap[c.task_id]?.order_id]
    console.log(`  ${c.id.slice(-8)} | Op: ${c.operation} | Status: ${c.status} | Qty: ${c.quantity} | Order: ${o?.order_num}`)
  })

  // demandForParent calculation for KF under 27
  // demandForParent = sum of planned_sets * qty_per_parent from tasks for this parent
  // ... simplified: demand comes from order quantity
  const demandOrders27 = orders.filter(o => {
    const p = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
    return String(p) === parentId27 && orderIds.includes(o.id)
  })
  console.log(`Demand orders (active):`)
  demandOrders27.forEach(o => {
    const t = tasks.find(t2 => t2.order_id === o.id && filterTaskIds.includes(t2.id))
    const snap = t?.plan_snapshot?.[String(kfNom?.id)]
    console.log(`  ${o.order_num}: planned_sets=${t?.planned_sets}, snap.need=${snap?.need}`)
  })

  // ====== CASE 2: Київ К-ІП9-10-П-7-46 under Рама F10 ======
  const parentF10 = nomenclatures.find(n => n.name === 'Рама F10')
  const kyivNom = nomenclatures.find(n => n.name === 'Київ К-ІП9-10-П-7-46')
  console.log('\n\n====== Київ К-ІП9-10-П-7-46 under Рама F10 ======')
  console.log(`Parent: ${parentF10?.name} (${parentF10?.id})`)
  console.log(`Child: ${kyivNom?.name} (${kyivNom?.id})`)

  const parentIdF10 = String(parentF10?.id)

  // orderTasks for F10
  const orderTasksF10 = tasks.filter(t => {
    if (!t.order_id || !orderIds.includes(t.order_id)) return false
    const o = ordersMap[t.order_id]
    if (!o) return false
    const oPid = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
    return String(oPid) === parentIdF10
  })
  const ordersWithTasksF10 = Array.from(new Set(orderTasksF10.map(t => t.order_id)))
  console.log(`ordersWithTasks for F10: ${ordersWithTasksF10.map(oid => ordersMap[oid]?.order_num).join(', ')}`)

  let initialStockF10 = 0
  ordersWithTasksF10.forEach(oid => {
    const taskWithSnap = orderTasksF10.find(t => t.order_id === oid && t.plan_snapshot && t.plan_snapshot[String(kyivNom?.id)])
    if (taskWithSnap) {
      const snap = taskWithSnap.plan_snapshot[String(kyivNom?.id)]
      const stock = Number(snap?.stock) || 0
      console.log(`  Order ${ordersMap[oid]?.order_num}: stock=${stock}`)
      initialStockF10 += stock
    }
  })
  console.log(`initialStockF10 = ${initialStockF10}`)

  // completedShop2Qty for Київ К under F10
  const shop2ops = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп']
  const completedShop2 = filteredCards.filter(c => {
    if (String(c.nomenclature_id) !== String(kyivNom?.id)) return false
    if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentIdF10) return false
    const op = (c.operation || '').toLowerCase()
    return shop2ops.some(o => op.includes(o)) && c.status === 'completed'
  })
  const completedShop2Qty = completedShop2.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
  console.log(`completedShop2Qty = ${completedShop2Qty} (${completedShop2.length} cards)`)
  completedShop2.forEach(c => {
    const o = ordersMap[tasksMap[c.task_id]?.order_id]
    console.log(`  ${c.id.slice(-8)} | Op: ${c.operation} | Qty: ${c.quantity} | Order: ${o?.order_num}`)
  })

  const totalPotentialSgpF10 = completedShop2Qty + initialStockF10
  console.log(`totalPotentialSgp = ${totalPotentialSgpF10}`)

  // groupProduced for F10
  const shop1ops = ['розкрій', 'галтовка', 'прийомка', 'сортування']
  const groupProducedF10 = filteredCards.filter(c => {
    if (String(c.nomenclature_id) !== String(kyivNom?.id)) return false
    if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentIdF10) return false
    const op = (c.operation || '').toLowerCase()
    return shop1ops.some(o => op.includes(o)) && (c.status === 'completed' || c.status === 'at-shop2-buffer')
  }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
  console.log(`groupProducedF10 = ${groupProducedF10}`)

  // BZ card from 260826-1
  const bzCardF10 = filteredCards.filter(c => {
    if (String(c.nomenclature_id) !== String(kyivNom?.id)) return false
    return true
  })
  console.log(`All cards for Київ К under F10 (no taskParentMap filter):`)
  bzCardF10.forEach(c => {
    const o = ordersMap[tasksMap[c.task_id]?.order_id]
    const tp = nomMap.get(taskParentMap[c.task_id])?.name
    console.log(`  ${c.id.slice(-8)} | Op: ${c.operation} | Status: ${c.status} | Qty: ${c.quantity} | Order: ${o?.order_num} | taskParent: ${tp}`)
  })

  // flow_totals for Київ К
  const flowKyiv = (flowTotals || []).filter(r => String(r.nomenclature_id) === String(kyivNom?.id))
  if (flowKyiv.length > 0) {
    console.log(`flow_totals for Київ К (${flowKyiv.length}):`)
    flowKyiv.slice(0, 10).forEach(r => {
      const tp = nomMap.get(taskParentMap[r.task_id])?.name
      const o = ordersMap[tasksMap[r.task_id]?.order_id]
      console.log(`  task=${r.task_id?.slice(-8)} | order=${o?.order_num} | stage=${r.stage} | total_good=${r.total_good} | taskParent=${tp}`)
    })
  } else {
    console.log('No flow_totals for Київ К')
  }

  // demandForParent for Київ К under F10
  const demandOrdersF10 = orders.filter(o => {
    const p = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
    return String(p) === parentIdF10 && orderIds.includes(o.id)
  })
  console.log(`Demand orders for F10 (active):`)
  let totalDemandF10 = 0
  demandOrdersF10.forEach(o => {
    const activeTF10 = tasks.find(t => t.order_id === o.id && filterTaskIds.includes(t.id))
    const snap = activeTF10?.plan_snapshot?.[String(kyivNom?.id)]
    const planned = Number(activeTF10?.planned_sets) || 0
    const snapNeed = Number(snap?.need) || 0
    const qtyPer = planned > 0 ? Math.round(snapNeed / planned) : snapNeed
    console.log(`  ${o.order_num}: planned_sets=${planned}, snap.need=${snapNeed}, qtyPer=${qtyPer}, demand contribution=${planned * qtyPer}`)
    totalDemandF10 += planned * qtyPer
  })
  console.log(`totalDemandF10 = ${totalDemandF10}`)
}

run().catch(console.error)
