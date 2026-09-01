import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function run() {
  const { data: cards } = await supabase.from('work_cards').select('*')
  const { data: tasks } = await supabase.from('tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: bomItems } = await supabase.from('bom_items').select('*')

  const ordersMap = {}
  orders.forEach(o => { ordersMap[o.id] = o })

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
    const hasActiveShop2Task = tasks.some(s2 =>
      String(s2.order_id) === String(t.order_id) &&
      s2.batch_index === t.batch_index &&
      (s2.step?.includes('Пресування') || s2.step?.includes('ЦЕХ №2') || s2.step?.includes('Доопрацювання')) &&
      s2.status !== 'completed'
    )
    return hasActiveShop2Task
  })

  console.log(`activeTasks count: ${activeTasks.length}`)
  activeTasks.forEach(t => console.log(`  Active Task: ${t.id} | Step: ${t.step} | Status: ${t.status} | Order: ${ordersMap[t.order_id]?.order_num}`))

  // Replicate buildWipGroups
  const buildWipGroups = (filterTaskIds) => {
    const selectedTasks = tasks.filter(t => filterTaskIds.includes(t.id))
    const orderIds = Array.from(new Set(selectedTasks.map(t => t.order_id).filter(Boolean)))
    const allTasksForOrders = tasks.filter(t => orderIds.includes(t.order_id))
    const allTaskIdsForOrders = allTasksForOrders.map(t => t.id)

    const filterSet = new Set(allTaskIdsForOrders)
    const dashboardCards = cards
    const filteredCards = dashboardCards.filter(c => c.task_id && filterSet.has(c.task_id))

    const parentToChildren = {}
    const childToParents = {}
    const taskParentMap = {}

    allTaskIdsForOrders.forEach(taskId => {
      const task = tasks.find(t => t.id === taskId)
      if (!task) return
      const order = ordersMap[task.order_id]
      if (!order) return

      let parentId = order.nomenclature_id
      if (!parentId && order.order_items?.length > 0) parentId = order.order_items[0].nomenclature_id
      if (!parentId) return
      parentId = String(parentId)
      taskParentMap[taskId] = parentId

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      const taskWithSnap = task.plan_snapshot && Object.keys(task.plan_snapshot).some(k => uuidRegex.test(k)) ? task : null

      if (!parentToChildren[parentId]) parentToChildren[parentId] = {}
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

    const groups = {}
    const productNoms = nomenclatures.filter(n => n.type === 'product')
    productNoms.forEach(prod => {
      if (parentToChildren[String(prod.id)]) {
        groups[prod.id] = { id: prod.id, name: prod.name, code: prod.code || '', rows: [] }
      }
    })

    const parts = nomenclatures.filter(n => n.type === 'part')

    parts.forEach(nom => {
      const parentIds = childToParents[nom.id] ? Array.from(childToParents[nom.id]) : []
      if (parentIds.length === 0) return

      parentIds.forEach(parentId => {
        if (!groups[parentId]) return

        const qtyPerProduct = parentToChildren[parentId]?.[nom.id] || 1

        const demandForParent = (() => {
          let d = 0
          filterTaskIds.forEach(taskId => {
            if (taskParentMap[taskId] !== parentId) return
            const task = tasks.find(t => t.id === taskId)
            d += Number(task?.planned_sets) || 0
          })
          return d * qtyPerProduct
        })()

        const qSort = filteredCards.filter(c => {
          if (String(c.nomenclature_id) !== String(nom.id)) return false
          if (c.task_id && taskParentMap[c.task_id] && taskParentMap[c.task_id] !== parentId) return false
          return c.status === 'at-shop2-buffer'
        }).reduce((s, c) => s + Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0)), 0)

        if (demandForParent > 0 || qSort > 0) {
          groups[parentId].rows.push({
            id: nom.id + '_' + parentId,
            name: nom.name,
            qSort,
            demand: demandForParent
          })
        }
      })
    })

    return Object.values(groups).filter(g => g.rows.length > 0)
  }

  const groups = buildWipGroups(activeTasks.map(t => t.id))
  console.log('\n=== BUILD WIP GROUPS RESULT ===')
  let grandTotalQSort = 0
  groups.forEach(g => {
    let groupQSort = 0
    g.rows.forEach(r => {
      groupQSort += r.qSort
      if (r.qSort > 0) console.log(`  Row ${r.name}: qSort=${r.qSort}`)
    })
    grandTotalQSort += groupQSort
    console.log(`Group: ${g.name} | qSort Sum = ${groupQSort}`)
  })
  console.log(`\nGRAND TOTAL qSort = ${grandTotalQSort}`)
}

run().catch(console.error)
