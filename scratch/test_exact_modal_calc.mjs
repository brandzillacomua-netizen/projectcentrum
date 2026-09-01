import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

export function getExactModalBufferPartsCount(workCards, inventory, tasks = [], orders = [], nomenclatures = []) {
  const bufferCards = (workCards || []).filter(c =>
    c.status === 'at-shop2-buffer' || (c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'new' || c.status === 'at-buffer'))
  )

  const taskGroups = {}

  bufferCards.forEach(card => {
    const taskId = card.task_id || 'unassigned'
    if (!taskGroups[taskId]) {
      taskGroups[taskId] = { taskId, items: {} }
    }
    const nomId = card.nomenclature_id
    if (!taskGroups[taskId].items[nomId]) {
      taskGroups[taskId].items[nomId] = { nomId, total_qty: 0 }
    }
    taskGroups[taskId].items[nomId].total_qty += Number(card.quantity) || 0
  })

  const shop2Inventory = (inventory || []).filter(i => (i.type === 'semi_shop2' || i.type === 'bz_shop2') && Number(i.total_qty) > 0)

  shop2Inventory.forEach(inv => {
    const nomId = inv.nomenclature_id
    let targetTaskId = Object.keys(taskGroups).find(tid => taskGroups[tid].items[nomId])

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
      if (!taskGroups[targetTaskId]) {
        taskGroups[targetTaskId] = { taskId: targetTaskId, items: {} }
      }
    }

    if (!taskGroups[targetTaskId].items[nomId]) {
      taskGroups[targetTaskId].items[nomId] = { nomId, total_qty: 0 }
    }

    const currentQty = taskGroups[targetTaskId].items[nomId].total_qty
    if (Number(inv.total_qty) > currentQty) {
      taskGroups[targetTaskId].items[nomId].total_qty = Number(inv.total_qty)
    }
  })

  let totalBufferPartsCount = 0
  Object.values(taskGroups).forEach(group => {
    Object.values(group.items).forEach(item => {
      if (item.total_qty > 0) {
        totalBufferPartsCount += item.total_qty
      }
    })
  })

  return totalBufferPartsCount
}

async function testExactModal() {
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*')
  const { data: tasks } = await supabase.from('production_tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')

  const total = getExactModalBufferPartsCount(workCards, inventory, tasks, orders)
  console.log('Exact Modal Buffer Parts Count:', total)
}

testExactModal().catch(console.error)
