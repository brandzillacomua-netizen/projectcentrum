import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function debugExactModal() {
  const { data: workCards } = await supabase.from('work_cards').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*')
  const { data: tasks } = await supabase.from('production_tasks').select('*')
  const { data: orders } = await supabase.from('orders').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')

  const bufferCards = (workCards || []).filter(c =>
    c.status === 'at-shop2-buffer' || (c.card_info?.includes('[ЦЕХ №2]') && (c.status === 'new' || c.status === 'at-buffer'))
  )

  const taskGroups = {}

  bufferCards.forEach(card => {
    const taskId = card.task_id || 'unassigned'
    if (!taskGroups[taskId]) {
      const taskObj = (tasks || []).find(t => String(t.id) === String(taskId))
      const orderObj = (orders || []).find(o => String(o.id) === String(card.order_id || taskObj?.order_id))
      const rawNum = orderObj?.order_num || taskObj?.order_num || card.card_info?.match(/Наряд №(\d+(?:-\d+)?)/)?.[1] || 'Вільний запас'
      const orderNumStr = String(rawNum)
      const displayNum = orderNumStr.startsWith('№') || orderNumStr.includes('Вільний') || orderNumStr.includes('Загальний')
        ? orderNumStr
        : `Наряд №${orderNumStr}`

      taskGroups[taskId] = {
        taskId,
        orderNum: displayNum,
        items: {}
      }
    }

    const nomId = card.nomenclature_id
    if (!taskGroups[taskId].items[nomId]) {
      const nom = (nomenclatures || []).find(n => String(n.id) === String(nomId))
      taskGroups[taskId].items[nomId] = {
        nomId,
        name: nom?.name || 'Деталь',
        unit: nom?.unit || 'шт',
        material: nom?.material_type || nom?.material || '—',
        total_qty: 0,
        cardCount: 0,
        updated_at: card.created_at
      }
    }
    taskGroups[taskId].items[nomId].total_qty += Number(card.quantity) || 0
    taskGroups[taskId].items[nomId].cardCount += 1
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

      if (matchedTask) {
        targetTaskId = matchedTask.id
        if (!taskGroups[targetTaskId]) {
          const orderObj = (orders || []).find(o => String(o.id) === String(matchedTask.order_id))
          const rawNum = orderObj?.order_num || matchedTask?.order_num || 'Вільний запас'
          const orderNumStr = String(rawNum)
          const displayNum = orderNumStr.startsWith('№') || orderNumStr.includes('Вільний') ? orderNumStr : `Наряд №${orderNumStr}`
          taskGroups[targetTaskId] = {
            taskId: targetTaskId,
            orderNum: displayNum,
            items: {}
          }
        }
      } else {
        targetTaskId = 'unassigned'
        if (!taskGroups[targetTaskId]) {
          taskGroups[targetTaskId] = {
            taskId: 'unassigned',
            orderNum: '📦 ВІЛЬНИЙ ЗАПАС СКЛАДУ / БЗ (БЕЗ НАРЯДУ)',
            items: {}
          }
        }
      }
    }

    if (!taskGroups[targetTaskId].items[nomId]) {
      const nom = (nomenclatures || []).find(n => String(n.id) === String(nomId))
      taskGroups[targetTaskId].items[nomId] = {
        nomId,
        name: nom?.name || inv.name,
        unit: inv.unit || nom?.unit || 'шт',
        material: nom?.material_type || nom?.material || '—',
        total_qty: 0,
        cardCount: 0,
        updated_at: inv.updated_at
      }
    }

    const currentQty = taskGroups[targetTaskId].items[nomId].total_qty
    if (Number(inv.total_qty) > currentQty) {
      taskGroups[targetTaskId].items[nomId].total_qty = Number(inv.total_qty)
    }
  })

  const rawGroupList = Object.values(taskGroups).filter(g => Object.keys(g.items).length > 0)

  let totalBufferPartsCount = 0
  rawGroupList.forEach(group => {
    let grpTotal = 0
    Object.values(group.items).forEach(item => {
      if (item.total_qty > 0) {
        grpTotal += item.total_qty
      }
    })
    console.log(`Group [${group.orderNum}]: ${grpTotal} шт (${Object.keys(group.items).length} items)`)
    totalBufferPartsCount += grpTotal
  })

  console.log('TOTAL MODAL BUFFER PARTS COUNT:', totalBufferPartsCount)
}

debugExactModal().catch(console.error)
