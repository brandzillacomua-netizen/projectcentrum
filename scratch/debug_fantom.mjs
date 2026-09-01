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
  const { data: flowTotals } = await supabase.from('flow_totals').select('*').limit(500)

  const nomMap = new Map(nomenclatures.map(n => [n.id, n]))
  const ordersMap = Object.fromEntries(orders.map(o => [o.id, o]))
  const tasksMap = Object.fromEntries(tasks.map(t => [t.id, t]))

  // Target parent: Рама (інд.проект 27), F415, Київ К
  const parentNom = nomenclatures.find(n => n.name.includes('інд.проект 27'))
  console.log('Target parent:', parentNom?.name, parentNom?.id)

  // Target child: Київ К-ІП9-10-П-7-46 and KF-Пластинка-3-162
  const targets = ['Київ К-ІП9-10-П-7-46', 'KF-Пластинка-3-162', 'KR-F-line-Підкладка-10-238']

  for (const targetName of targets) {
    const childNom = nomenclatures.find(n => n.name === targetName)
    if (!childNom) { console.log(`\n[${targetName}] NOT FOUND in nomenclatures`); continue }
    console.log(`\n===== ${targetName} (${childNom.id}) =====`)

    // Find order for Рама (інд.проект 27)
    const parentOrders = orders.filter(o => {
      const pId = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id
      return String(pId) === String(parentNom?.id)
    })
    console.log(`Parent orders: ${parentOrders.map(o => o.order_num).join(', ')}`)

    // Find tasks for those orders
    const parentTaskIds = tasks.filter(t => parentOrders.some(o => o.id === t.order_id)).map(t => t.id)
    console.log(`Parent task ids: ${parentTaskIds.map(id => id.slice(-8)).join(', ')}`)

    // Build taskParentMap for ALL orders
    const taskParentMap = {}
    tasks.forEach(t => {
      const o = ordersMap[t.order_id]
      const p = o?.nomenclature_id || o?.order_items?.[0]?.nomenclature_id
      if (p) taskParentMap[t.id] = String(p)
    })

    // childToParents seeding (foreman dashboard logic: if/else snapshot vs BOM)
    const parentToChildren = {}
    const childToParents = {}
    const orderIds = [...new Set(tasks.filter(t => t.status !== 'cancelled').map(t => t.order_id))]
    const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))

    allTasksForOrders.forEach(task => {
      const order = ordersMap[task.order_id]
      if (!order) return
      let pId = order.nomenclature_id || order.order_items?.[0]?.nomenclature_id
      if (!pId) return
      pId = String(pId)
      if (!parentToChildren[pId]) parentToChildren[pId] = {}
      const taskWithSnap = task.plan_snapshot && Object.keys(task.plan_snapshot).some(k => uuidRegex.test(k)) ? task : null
      if (taskWithSnap) {
        Object.entries(task.plan_snapshot).forEach(([childId, entry]) => {
          if (!uuidRegex.test(childId)) return
          if (!childToParents[childId]) childToParents[childId] = new Set()
          childToParents[childId].add(pId)
        })
      } else {
        bomItems.filter(b => String(b.parent_id) === pId).forEach(b => {
          const cId = String(b.child_id)
          if (!childToParents[cId]) childToParents[cId] = new Set()
          childToParents[cId].add(pId)
        })
      }
    })

    const parentIds = childToParents[childNom.id] ? Array.from(childToParents[childNom.id]) : []
    console.log(`childToParents groups: ${parentIds.map(id => nomMap.get(id)?.name).join(' | ')}`)

    // Check plan_snapshot for parent task — initialStock
    const parentTasks = tasks.filter(t => parentOrders.some(o => o.id === t.order_id))
    parentTasks.forEach(task => {
      const snapEntry = task.plan_snapshot?.[childNom.id]
      if (snapEntry) {
        console.log(`  Snapshot[${task.id.slice(-8)}]: stock=${snapEntry.stock}, sheets=${snapEntry.sheets}, units_per_sheet=${snapEntry.units_per_sheet}, need=${snapEntry.need}`)
      }
    })

    // Find all filteredCards for this child nom across all active tasks
    const filterSet = new Set(allTasksForOrders.map(t => t.id))
    const filteredCards = cards.filter(c => c.task_id && filterSet.has(c.task_id))
    const childCards = filteredCards.filter(c => String(c.nomenclature_id) === String(childNom.id))

    console.log(`All cards for this nom in filteredCards (${childCards.length}):`)
    childCards.forEach(c => {
      const order = ordersMap[tasksMap[c.task_id]?.order_id]
      const taskParent = nomMap.get(taskParentMap[c.task_id])?.name
      console.log(`  Card ${c.id.slice(-8)} | Op: ${c.operation} | Status: ${c.status} | Qty: ${c.quantity} | Order: ${order?.order_num} | taskParent: ${taskParent}`)
    })

    // Check flow_totals for this nom
    const flowForNom = (flowTotals || []).filter(r => String(r.nomenclature_id) === String(childNom.id))
    if (flowForNom.length > 0) {
      console.log(`Flow totals (${flowForNom.length}):`)
      flowForNom.forEach(r => {
        const order = ordersMap[tasksMap[r.task_id]?.order_id]
        const taskParent = nomMap.get(taskParentMap[r.task_id])?.name
        console.log(`  Flow ${r.id?.slice(-8)} | task: ${r.task_id?.slice(-8)} | order: ${order?.order_num} | taskParent: ${taskParent} | total_good: ${r.total_good} | stage: ${r.stage}`)
      })
    }

    // Simulate qSgp for parent = Рама (інд.проект 27)
    if (parentNom) {
      const pId = String(parentNom.id)
      const taskWithSnap = parentTasks.find(t => t.plan_snapshot && Object.keys(t.plan_snapshot).some(k => uuidRegex.test(k)))

      let initialStock = 0, plannedReserve = 0
      if (taskWithSnap) {
        const snapEntry = taskWithSnap.plan_snapshot[childNom.id]
        if (snapEntry) {
          const stock = Number(snapEntry.stock) || 0
          const sheets = Number(snapEntry.sheets) || 0
          const units = Number(snapEntry.units_per_sheet) || 1
          const need = Number(snapEntry.need) || 0
          initialStock = stock
          plannedReserve = Math.max(0, (sheets * units) + stock - need)
        }
      }

      const completedShop2Qty = filteredCards.filter(c => {
        if (String(c.nomenclature_id) !== String(childNom.id)) return false
        if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== pId) return false
        const op = (c.operation || '').toLowerCase()
        const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o))
        return isShop2 && c.status === 'completed'
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const groupProduced = filteredCards.filter(c => {
        if (String(c.nomenclature_id) !== String(childNom.id)) return false
        if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== pId) return false
        const op = (c.operation || '').toLowerCase()
        const isShop1 = ['розкрій', 'галтовка', 'прийомка', 'сортування'].some(o => op.includes(o))
        return isShop1 && (c.status === 'completed' || c.status === 'at-shop2-buffer')
      }).reduce((s, c) => s + (Number(c.quantity) || 0), 0)

      const qSort = filteredCards.filter(c => {
        if (String(c.nomenclature_id) !== String(childNom.id)) return false
        return c.status === 'at-shop2-buffer'
      }).reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

      const sgpProduced = Math.max(0, groupProduced - qSort)
      const flowRowsForParent = (flowTotals || []).filter(r => {
        if (String(r.nomenclature_id) !== String(childNom.id)) return false
        if (!allTasksForOrders.some(t => t.id === r.task_id)) return false
        return !taskParentMap[r.task_id] || taskParentMap[r.task_id] === pId
      })
      const flowSgp = flowRowsForParent.filter(r => r.stage === 'sgp').reduce((s, r) => s + (Number(r.total_good) || 0), 0)
      const flowScrap = flowRowsForParent.reduce((s, r) => s + (Number(r.total_scrap) || 0), 0)
      const netSgpQty = Math.max(0, flowSgp - flowScrap)
      const totalPotentialSgp = completedShop2Qty + initialStock

      // demand calculation
      const demandForParent = 0 // simplified

      console.log(`\nSimulation for parent Рама (інд.проект 27):`)
      console.log(`  initialStock=${initialStock}, plannedReserve=${plannedReserve}`)
      console.log(`  completedShop2Qty=${completedShop2Qty}`)
      console.log(`  groupProduced=${groupProduced}`)
      console.log(`  qSort=${qSort}`)
      console.log(`  sgpProduced=${sgpProduced}`)
      console.log(`  flowSgp=${flowSgp}, flowScrap=${flowScrap}, netSgpQty=${netSgpQty}`)
      console.log(`  totalPotentialSgp=${totalPotentialSgp}`)
      console.log(`  producedForSgp = groupProduced > 0 ? sgpProduced : netSgpQty = ${groupProduced > 0 ? sgpProduced : netSgpQty}`)
    }
  }
}

run().catch(console.error)
