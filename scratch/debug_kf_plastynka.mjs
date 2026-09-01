import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function run() {
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: bomItems } = await supabase.from('bom_items').select('*')

  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))
  const ordersMap = Object.fromEntries(orders.map(o => [o.id, o]))

  // Find KF-Пластинка-3-162 nom
  const kfNom = nomenclatures.find(n => n.name === 'KF-Пластинка-3-162')
  console.log('KF-Пластинка-3-162:', kfNom?.id, kfNom?.name)

  // Find which BOM parents include KF-Пластинка-3-162
  const bomParents = bomItems.filter(b => String(b.child_id) === String(kfNom?.id))
  console.log('\nBOM parents:')
  bomParents.forEach(b => {
    const pNom = nomMap.get(b.parent_id)
    console.log(`  Parent: ${pNom?.name} (${b.parent_id}) | qty_per_parent: ${b.quantity_per_parent}`)
  })

  // Find all active tasks (Розкрій, confirmed)
  const relevantTasks = tasks.filter(t => {
    const stepName = (t.step || '').toLowerCase()
    const isLaser = stepName.includes('розкрій') || stepName.includes('різка')
    const hasActiveShop2Task = tasks.some(s2 =>
      String(s2.order_id) === String(t.order_id) &&
      s2.batch_index === t.batch_index &&
      (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
      s2.status !== 'completed'
    )
    if (t.status !== 'completed' || hasActiveShop2Task) {
      return (t.warehouse_conf === 'true' || t.warehouse_conf === 'partial') && t.engineer_conf && t.director_conf && isLaser
    }
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    const isRecent = (t.completed_at && new Date(t.completed_at) > threeDaysAgo) ||
      (t.updated_at && new Date(t.updated_at) > threeDaysAgo)
    return isRecent && (isLaser || !t.step)
  })

  const activeTasks = relevantTasks.filter(t => {
    if (t.status !== 'completed') return true
    return tasks.some(s2 =>
      String(s2.order_id) === String(t.order_id) &&
      s2.batch_index === t.batch_index &&
      (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
      s2.status !== 'completed'
    )
  })

  console.log('\nActive tasks:')
  activeTasks.forEach(t => {
    const o = ordersMap[t.order_id]
    const parentNom = nomMap.get(o?.nomenclature_id)
    console.log(`  Task ${t.id.slice(-8)} | Order: ${o?.order_num} | ParentNom: ${parentNom?.name}`)
  })

  // Build taskParentMap
  const filterTaskIds = activeTasks.map(t => t.id)
  const selectedTasks = tasks.filter(t => filterTaskIds.includes(t.id))
  const orderIds = Array.from(new Set(selectedTasks.map(t => t.order_id).filter(Boolean)))
  const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))
  const allTaskIdsForOrders = allTasksForOrders.map(t => t.id)
  const filterSet = new Set(allTaskIdsForOrders)

  const taskParentMap = {}
  allTaskIdsForOrders.forEach(taskId => {
    const t = tasks.find(x => x.id === taskId)
    const o = ordersMap[t?.order_id]
    let p = o?.nomenclature_id || o?.order_items?.[0]?.nomenclature_id
    if (p) taskParentMap[taskId] = String(p)
  })

  // Build childToParents map (for Foreman dashboard logic)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const parentToChildren = {}
  const childToParents = {}

  allTaskIdsForOrders.forEach(taskId => {
    const task = tasks.find(t => t.id === taskId)
    if (!task) return
    const order = ordersMap[task.order_id]
    if (!order) return
    let parentId = order.nomenclature_id
    if (!parentId && order.order_items?.length > 0) parentId = order.order_items[0].nomenclature_id
    if (!parentId) return
    parentId = String(parentId)

    if (!parentToChildren[parentId]) parentToChildren[parentId] = {}
    const taskWithSnap = task.plan_snapshot && Object.keys(task.plan_snapshot).some(k => uuidRegex.test(k)) ? task : null
    if (taskWithSnap) {
      const plannedSets = Number(task.planned_sets) || 1
      Object.entries(task.plan_snapshot).forEach(([childId, entry]) => {
        if (!uuidRegex.test(childId)) return
        const need = Number(entry.need) || 0
        const qtyPer = plannedSets > 0 ? Math.round(need / plannedSets) : need
        parentToChildren[parentId][childId] = qtyPer
        if (!childToParents[childId]) childToParents[childId] = new Set()
        childToParents[childId].add(parentId)
      })
    } else {
      bomItems.filter(b => String(b.parent_id) === parentId).forEach(b => {
        const childId = String(b.child_id)
        parentToChildren[parentId][childId] = Number(b.quantity_per_parent) || 1
        if (!childToParents[childId]) childToParents[childId] = new Set()
        childToParents[childId].add(parentId)
      })
    }
  })

  console.log('\nchildToParents for KF-Пластинка-3-162:', childToParents[kfNom?.id] ? Array.from(childToParents[kfNom?.id]).map(id => nomMap.get(id)?.name) : 'NONE')

  // Now find all cards for KF-Пластинка-3-162 that are in filteredCards
  const filteredCards = cards.filter(c => c.task_id && filterSet.has(c.task_id))
  const kfCards = filteredCards.filter(c => String(c.nomenclature_id) === String(kfNom?.id))
  console.log('\nAll KF-Пластинка-3-162 cards in filteredCards:')
  kfCards.forEach(c => {
    const order = ordersMap[tasks.find(t => t.id === c.task_id)?.order_id]
    console.log(`  Card ${c.id.slice(-8)} | Status: ${c.status} | Op: ${c.operation} | Qty: ${c.quantity} | Order: ${order?.order_num} | taskParentMap: ${nomMap.get(taskParentMap[c.task_id])?.name}`)
  })

  // Simulate qSortAct for each parent group
  const parentIds = childToParents[kfNom?.id] ? Array.from(childToParents[kfNom?.id]) : []
  console.log('\nSimulate qSortAct per parent group:')
  parentIds.forEach(parentId => {
    const parentName = nomMap.get(parentId)?.name
    const qSortAct = filteredCards.filter(c => {
      if (String(c.nomenclature_id) !== String(kfNom?.id)) return false
      if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
      return c.operation === 'Сортування' && ['new', 'in-progress', 'at-buffer'].includes(c.status)
    }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    console.log(`  Parent: ${parentName} | qSortAct: ${qSortAct}`)
  })

  // Simulate sum for each parent
  console.log('\nSimulate full sum per parent group:')
  parentIds.forEach(parentId => {
    const parentName = nomMap.get(parentId)?.name
    const allForParent = filteredCards.filter(c => {
      if (String(c.nomenclature_id) !== String(kfNom?.id)) return false
      if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
      return true
    })
    const total = allForParent.reduce((s, c) => s + (Number(c.quantity) || 0), 0)
    console.log(`  Parent: ${parentName} | total cards qty: ${total}`)
    allForParent.forEach(c => {
      const o = ordersMap[tasks.find(t => t.id === c.task_id)?.order_id]
      console.log(`    Card ${c.id.slice(-8)} | Status: ${c.status} | Op: ${c.operation} | Qty: ${c.quantity} | Order: ${o?.order_num}`)
    })
  })
}

run().catch(console.error)
