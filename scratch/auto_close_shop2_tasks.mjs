const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const headers = {
  'apikey': supabaseAnonKey,
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'x-mes-secret': 'CentrumMES2026SecretKey_a9f8',
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
}

async function apiFetchAll(table, query = '') {
  let allRows = []
  let page = 0
  const pageSize = 1000
  while (true) {
    const rangeHeader = { ...headers, 'Range': `${page * pageSize}-${(page + 1) * pageSize - 1}` }
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, { headers: rangeHeader })
    if (!res.ok) {
      throw new Error(`Failed to fetch ${table}: ${res.statusText}`)
    }
    const rows = await res.json()
    allRows = allRows.concat(rows)
    if (rows.length < pageSize) break
    page++
  }
  return allRows
}

async function apiInsert(table, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Failed to insert into ${table}: ${res.statusText} - ${txt}`)
  }
  return res.json()
}

async function apiUpdate(table, query, body) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}${query}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Failed to update ${table}: ${res.statusText} - ${txt}`)
  }
  return res.json()
}

const EXCLUDED_ORDER_NUMS = [
  '14082026-01',
  '10082026-01',
  '260821-1',
  '260820-1'
]

async function completeTaskShop2(taskId, task, order, nomenclatures, bomItems, inventory, workCards) {
  const nowIso = new Date().toISOString()
  
  // 1. Mark task completed
  await apiUpdate('tasks', `?id=eq.${taskId}`, { status: 'completed', completed_at: nowIso })

  // 2. Clean up inventory for related nomenclatures
  const itemNoms = (order?.order_items || []).map(it => String(it.nomenclature_id))
  const childIds = (bomItems || []).filter(b => itemNoms.includes(String(b.parent_id))).map(b => String(b.child_id))
  const allRelatedNoms = Array.from(new Set([...itemNoms, ...childIds]))

  for (const nomId of allRelatedNoms) {
    const shop2Stock = (inventory || []).filter(i => String(i.nomenclature_id) === String(nomId) && (i.type === 'wip_bz' || i.type === 'bz_shop2'))
    let totalToMove = 0
    for (const s of shop2Stock) totalToMove += (Number(s.total_qty) || 0)

    if (totalToMove > 0) {
      const bzItems = (inventory || []).filter(i => String(i.nomenclature_id) === String(nomId) && i.type === 'bz')
      if (bzItems.length > 0) {
        const bzItem = bzItems[0]
        await apiUpdate('inventory', `?id=eq.${bzItem.id}`, { total_qty: (Number(bzItem.total_qty) || 0) + totalToMove })
      } else {
        const nom = nomenclatures.find(n => String(n.id) === String(nomId))
        await apiInsert('inventory', [{ nomenclature_id: nomId, name: nom?.name || 'BZ Item', unit: nom?.unit || 'шт', total_qty: totalToMove, reserved_qty: 0, type: 'bz', pocket_owner: null }])
      }

      for (const s of shop2Stock) {
        if (s.type === 'bz_shop2') {
          await apiUpdate('inventory', `?id=eq.${s.id}`, { total_qty: 0 })
        }
      }
    }

    const semiShop2Items = (inventory || []).filter(i => String(i.nomenclature_id) === String(nomId) && i.type === 'semi_shop2')
    for (const item of semiShop2Items) {
      if ((Number(item.total_qty) || 0) > 0) {
        await apiUpdate('inventory', `?id=eq.${item.id}`, { total_qty: 0 })
      }
    }
  }

  // 3. Clean up unconsumed at-shop2-buffer cards for this order and move leftover to BZ
  if (task.order_id) {
    const unconsumedBufferCards = workCards.filter(c => String(c.order_id) === String(task.order_id) && c.status === 'at-shop2-buffer')
    for (const bufCard of unconsumedBufferCards) {
      const bufQty = Number(bufCard.quantity) || 0
      const usedQty = Number(bufCard.used_in_shop2_qty) || 0
      const leftover = bufQty - usedQty
      if (leftover > 0) {
        await apiUpdate('work_cards', `?id=eq.${bufCard.id}`, { used_in_shop2_qty: bufQty })
        const bzItems = inventory.filter(i => String(i.nomenclature_id) === String(bufCard.nomenclature_id) && i.type === 'bz')
        if (bzItems.length > 0) {
          const item = bzItems[0]
          await apiUpdate('inventory', `?id=eq.${item.id}`, { total_qty: (Number(item.total_qty) || 0) + leftover })
        } else {
          const nom = nomenclatures.find(n => String(n.id) === String(bufCard.nomenclature_id))
          await apiInsert('inventory', [{ nomenclature_id: bufCard.nomenclature_id, name: nom?.name || 'Деталь', unit: nom?.unit || 'шт', total_qty: leftover, reserved_qty: 0, type: 'bz', pocket_owner: null }])
        }
      }
    }
  }
}

async function run() {
  console.log("=== AUTO-CLOSING ALL READY/QUALIFYING SHOP 2 TASKS ===")

  const allTasks = await apiFetchAll('tasks', '?select=*')
  const openTasks = allTasks.filter(t => t.status !== 'completed')
  const orders = await apiFetchAll('orders', '?select=*')
  const nomenclatures = await apiFetchAll('nomenclatures', '?select=*')
  const bomItems = await apiFetchAll('bom_items', '?select=*')
  const workCards = await apiFetchAll('work_cards', '?select=*')
  const inventory = await apiFetchAll('inventory', '?select=*')

  const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))

  const shop2OpenTasks = openTasks.filter(t => 
    t.step?.includes('Пресування') || 
    t.step?.includes('ЦЕХ №2') || 
    t.step?.includes('Доопрацювання')
  )

  let closedCount = 0

  for (const task of shop2OpenTasks) {
    const order = ordersMap.get(String(task.order_id))
    const orderNum = order?.order_num || ''

    if (EXCLUDED_ORDER_NUMS.includes(orderNum)) {
      console.log(`[EXCLUDED] Order #${orderNum} (Task ID: ${task.id}) is in exclusion list.`)
      continue
    }

    console.log(`[CLOSING TASK] Closing Shop 2 Task ID: ${task.id} | Order #${orderNum} | Step: ${task.step}...`)
    await completeTaskShop2(task.id, task, order, nomenclatures, bomItems, inventory, workCards)
    closedCount++
  }

  console.log(`\n==================================================`)
  console.log(`SUCCESS:`)
  console.log(`  - Total Shop 2 Tasks Closed: ${closedCount}`)
}

run().catch(err => console.error("AUTO CLOSE ERROR:", err))
