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
  '260821-1'
]

const ALLOWED_PRODUCTS = [
  'F10',
  'Рама F10',
  'Рама KHARAK 10`(210)',
  'Рама KHARAK 10\'(210)',
  'Рама KHARAK 15" (325)'
]

function isAllowedProduct(productName) {
  if (!productName) return false
  const norm = productName.trim().toLowerCase()
  return ALLOWED_PRODUCTS.some(p => norm.includes(p.toLowerCase()) || p.toLowerCase().includes(norm))
}

async function run() {
  console.log("=== EXECUTING DIRECT HANDOVER TO SGP (BY ORDER ID) ===")

  const allTasks = await apiFetchAll('tasks', '?select=*')
  const tasks = allTasks.filter(t => t.status !== 'completed')
  const orders = await apiFetchAll('orders', '?select=id,order_num,customer,nomenclature_id,order_items(id,nomenclature_id,quantity)')
  const nomenclatures = await apiFetchAll('nomenclatures', '?select=*')
  const workCards = await apiFetchAll('work_cards', '?select=*')
  const inventory = await apiFetchAll('inventory', '?select=*')

  const ordersMap = new Map((orders || []).map(o => [String(o.id), o]))
  const nomMap = new Map((nomenclatures || []).map(n => [String(n.id), n]))

  let totalSgpCardsCreated = 0
  let totalFinishedQtyAdded = 0
  let totalBzQtyAdded = 0

  for (const task of tasks) {
    const order = ordersMap.get(String(task.order_id))
    const orderNum = order?.order_num || ''
    
    if (EXCLUDED_ORDER_NUMS.includes(orderNum)) continue

    let productName = order?.order_items?.map(it => nomMap.get(String(it.nomenclature_id))?.name).filter(Boolean).join(', ')
    if (!productName && task.plan_snapshot) {
      productName = Object.values(task.plan_snapshot)
        .map(s => nomMap.get(String(s.id))?.name || s.name)
        .filter(Boolean)
        .join(', ')
    }

    if (!isAllowedProduct(productName)) continue

    const snapshot = task.plan_snapshot || {}
    const orderCards = workCards.filter(c => String(c.order_id) === String(task.order_id) && c.operation !== 'Склад БЗ')

    const partIds = Object.keys(snapshot).filter(idStr => {
      if (idStr.startsWith('_') || ['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(idStr)) return false
      const snap = snapshot[idStr]
      return snap && typeof snap === 'object' && Number(snap.need || 0) > 0
    })

    for (const nomIdStr of partIds) {
      const snap = snapshot[nomIdStr]
      const needQty = Number(snap?.need) || 0
      const nom = nomMap.get(String(nomIdStr)) || nomMap.get(String(snap?.id))
      if (!nom) continue

      const nomenclatureId = String(nom.id)
      const bufferCards = orderCards.filter(c => String(c.nomenclature_id) === nomenclatureId && c.status === 'at-shop2-buffer')
      
      const totalAvailableInBuffer = bufferCards.reduce((sum, c) => {
        const available = Math.max(0, (Number(c.quantity) || 0) - (Number(c.used_in_shop2_qty) || 0))
        return sum + available
      }, 0)

      if (totalAvailableInBuffer <= 0) continue

      const finishedQty = Math.min(totalAvailableInBuffer, needQty)
      const actualBzQty = Math.max(0, totalAvailableInBuffer - finishedQty)

      console.log(`[HANDOVER SGP] Order #${orderNum} | Task: ${task.step} | Part: ${nom.name}`)
      console.log(`   Buffer Available: ${totalAvailableInBuffer} -> SGP (Finished): ${finishedQty}, BZ: ${actualBzQty}`)

      // 1. Insert completed SGP work card
      const cardPayload = {
        task_id: task.id,
        order_id: task.order_id,
        nomenclature_id: nom.id,
        quantity: totalAvailableInBuffer,
        operation: 'Пакування/СГП',
        status: 'completed',
        operator_name: 'Система',
        completed_at: new Date().toISOString(),
        card_info: `[ЦЕХ №2] [NEED:${finishedQty}] [BZ:${actualBzQty}] Наряд №${orderNum} [ПРЯМА ПЕРЕДАЧА]`
      }

      const insertedCards = await apiInsert('work_cards', [cardPayload])
      const createdCard = insertedCards[0]
      totalSgpCardsCreated++

      // 2. Mark used_in_shop2_qty on source at-shop2-buffer cards
      let remainingToDeduct = totalAvailableInBuffer
      for (const srcCard of bufferCards) {
        if (remainingToDeduct <= 0) break
        const currentUsed = Number(srcCard.used_in_shop2_qty) || 0
        const cardQty = Number(srcCard.quantity) || 0
        const availableInCard = Math.max(0, cardQty - currentUsed)
        if (availableInCard <= 0) continue

        const toUse = Math.min(availableInCard, remainingToDeduct)
        await apiUpdate('work_cards', `?id=eq.${srcCard.id}`, { used_in_shop2_qty: currentUsed + toUse })
        remainingToDeduct -= toUse
      }

      // 3. Add to inventory finished / bz
      if (finishedQty > 0) {
        const finishedItems = inventory.filter(i => String(i.nomenclature_id) === nomenclatureId && i.type === 'finished')
        if (finishedItems.length > 0) {
          const item = finishedItems[0]
          await apiUpdate('inventory', `?id=eq.${item.id}`, { total_qty: (Number(item.total_qty) || 0) + finishedQty })
        } else {
          await apiInsert('inventory', [{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: finishedQty, reserved_qty: 0, type: 'finished' }])
        }
        totalFinishedQtyAdded += finishedQty
      }

      if (actualBzQty > 0) {
        const bzItems = inventory.filter(i => String(i.nomenclature_id) === nomenclatureId && i.type === 'bz')
        if (bzItems.length > 0) {
          const item = bzItems[0]
          await apiUpdate('inventory', `?id=eq.${item.id}`, { total_qty: (Number(item.total_qty) || 0) + actualBzQty })
        } else {
          await apiInsert('inventory', [{ nomenclature_id: nom.id, name: nom.name, unit: nom.unit || 'шт', total_qty: actualBzQty, reserved_qty: 0, type: 'bz', pocket_owner: null }])
        }
        totalBzQtyAdded += actualBzQty
      }

      // 4. Insert work_card_history
      if (createdCard?.id) {
        await apiInsert('work_card_history', [{
          card_id: createdCard.id,
          nomenclature_id: nom.id,
          stage_name: 'Пакування/СГП',
          operator_name: 'Система (ПРЯМА ПЕРЕДАЧА)',
          qty_at_start: totalAvailableInBuffer,
          qty_completed: totalAvailableInBuffer,
          scrap_qty: 0,
          completed_at: new Date().toISOString()
        }])
      }
    }
  }

  console.log(`\n==================================================`)
  console.log(`SUCCESS:`)
  console.log(`  - SGP Work Cards Created: ${totalSgpCardsCreated}`)
  console.log(`  - Finished Goods Qty Added to SGP: ${totalFinishedQtyAdded} pcs`)
  console.log(`  - Safety Stock Qty Added to BZ: ${totalBzQtyAdded} pcs`)
}

run().catch(err => console.error("EXECUTION ERROR:", err))
