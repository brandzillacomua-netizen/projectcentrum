import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

export function calculateTotalBufferParts(workCards, inventory, tasks = [], orders = []) {
  const taskGroups = {}

  // 1. Process active cards in at-shop2-buffer
  const bufferCards = (workCards || []).filter(c =>
    c.status === 'at-shop2-buffer' || (c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'new' || c.status === 'at-buffer'))
  )

  bufferCards.forEach(card => {
    const taskId = card.task_id || 'unassigned'
    if (!taskGroups[taskId]) taskGroups[taskId] = {}
    const nomId = card.nomenclature_id
    if (!taskGroups[taskId][nomId]) taskGroups[taskId][nomId] = 0
    taskGroups[taskId][nomId] += Number(card.quantity) || 0
  })

  // 2. Process inventory items (semi_shop2 and bz_shop2)
  const shop2Inventory = (inventory || []).filter(i => (i.type === 'semi_shop2' || i.type === 'bz_shop2') && Number(i.total_qty) > 0)

  shop2Inventory.forEach(inv => {
    const nomId = inv.nomenclature_id
    let targetTaskId = Object.keys(taskGroups).find(tid => taskGroups[tid][nomId] !== undefined)

    if (!targetTaskId) {
      const cardMatch = (workCards || []).find(c => String(c.nomenclature_id) === String(nomId) && (c.task_id || c.card_info?.includes('Наряд №')))
      let matchedTask = null
      if (cardMatch?.task_id) {
        matchedTask = (tasks || []).find(t => String(t.id) === String(cardMatch.task_id))
      }

      if (!matchedTask) {
        matchedTask = (tasks || []).find(t => {
          const parts = t.plan_snapshot?.parts || []
          return parts.some(p => String(p.nomenclature_id || p.id) === String(nomId))
        })
      }

      if (!matchedTask) {
        const matchedOrder = (orders || []).find(o => (o.order_items || []).some(it => String(it.nomenclature_id) === String(nomId)))
        if (matchedOrder) {
          matchedTask = (tasks || []).find(t => String(t.order_id) === String(matchedOrder.id))
        }
      }

      targetTaskId = matchedTask ? matchedTask.id : 'unassigned'
      if (!taskGroups[targetTaskId]) taskGroups[targetTaskId] = {}
    }

    const currentQty = taskGroups[targetTaskId][nomId] || 0
    if (Number(inv.total_qty) > currentQty) {
      taskGroups[targetTaskId][nomId] = Number(inv.total_qty)
    }
  })

  let totalCount = 0
  Object.values(taskGroups).forEach(group => {
    Object.values(group).forEach(qty => {
      if (qty > 0) totalCount += qty
    })
  })

  return totalCount
}

async function testSharedCalc() {
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*')
  const { data: tasks } = await supabase.from('production_tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const total = calculateTotalBufferParts(workCards, inventory, tasks, orders)
  console.log('Shared calculateTotalBufferParts result:', total)
}

testSharedCalc().catch(console.error)
