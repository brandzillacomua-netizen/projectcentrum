const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const ORDER_NUM = '04072026-01'
const outputPath = path.join(__dirname, `audit_${ORDER_NUM.replace(/[^0-9a-z-]/gi, '_')}_truth_output.json`)

const norm = (value) => String(value || '').toLowerCase().replace(/\s+/g, '')
const qty = (value) => Number(value) || 0
const add = (map, key, value) => map.set(key || '-', (map.get(key || '-') || 0) + qty(value))

const isShop1Op = (op) => {
  const x = norm(op)
  return ['розкрій', 'галтовка', 'прийом', 'прийм', 'сортування'].some(s => x.includes(s))
}

const isSgpStage = (stage) => {
  const x = norm(stage)
  return x.includes('сгп') || x.includes('пакування')
}

const isBzStage = (stage) => {
  const x = norm(stage)
  return x.includes('бз') || x.includes('bz')
}

async function main() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, order_num, customer, nomenclature_id, quantity')
    .eq('order_num', ORDER_NUM)
  if (orderError) throw orderError
  if (!orders?.length) throw new Error(`Order ${ORDER_NUM} not found`)
  const order = orders[0]

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id, order_id, step, status, planned_sets, plan_snapshot, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  if (taskError) throw taskError
  const taskIds = (tasks || []).map(t => t.id)

  const snapshot = {}
  for (const task of tasks || []) {
    const snap = task.plan_snapshot || {}
    for (const [nomId, entry] of Object.entries(snap)) {
      if (!/^[0-9a-f-]{36}$/i.test(nomId)) continue
      if (!snapshot[nomId]) {
        snapshot[nomId] = { need: 0, stock: 0, sheets: 0, units_per_sheet: 1 }
      }
      snapshot[nomId].need = Math.max(snapshot[nomId].need, qty(entry.need))
      snapshot[nomId].stock = Math.max(snapshot[nomId].stock, qty(entry.stock))
      snapshot[nomId].sheets = Math.max(snapshot[nomId].sheets, qty(entry.sheets))
      snapshot[nomId].units_per_sheet = qty(entry.units_per_sheet) || snapshot[nomId].units_per_sheet || 1
    }
  }

  const nomIds = Object.keys(snapshot)
  const { data: noms, error: nomError } = await supabase
    .from('nomenclatures')
    .select('id, name, type')
    .in('id', nomIds)
  if (nomError) throw nomError
  const parts = (noms || []).filter(n => n.type === 'part')
  const partIds = parts.map(n => n.id)
  const nomById = new Map(parts.map(n => [String(n.id), n]))

  const { data: cards, error: cardError } = taskIds.length
    ? await supabase
      .from('work_cards')
      .select('id, task_id, order_id, nomenclature_id, operation, status, quantity, used_in_shop2_qty, is_rework, card_info, created_at')
      .in('task_id', taskIds)
      .in('nomenclature_id', partIds)
      .order('created_at', { ascending: true })
    : { data: [], error: null }
  if (cardError) throw cardError

  const { data: flowRows, error: flowError } = await supabase
    .from('work_card_flow_totals')
    .select('id, card_id, task_id, order_id, nomenclature_id, stage_name, total_good, total_bz, total_scrap, updated_at')
    .eq('order_id', order.id)
    .in('nomenclature_id', partIds)
  if (flowError) throw flowError

  const { data: scrapRows, error: scrapError } = await supabase
    .from('work_card_scrap_totals')
    .select('id, card_id, task_id, order_id, nomenclature_id, total_scrap, updated_at')
    .eq('order_id', order.id)
    .in('nomenclature_id', partIds)
  if (scrapError) throw scrapError

  const { data: invRows, error: invError } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty')
    .in('nomenclature_id', partIds)
  if (invError) throw invError

  const result = {
    order_num: ORDER_NUM,
    order_id: order.id,
    task_count: taskIds.length,
    card_count: cards?.length || 0,
    flow_row_count: flowRows?.length || 0,
    scrap_row_count: scrapRows?.length || 0,
    parts: []
  }

  for (const part of parts.sort((a, b) => a.name.localeCompare(b.name))) {
    const id = String(part.id)
    const snap = snapshot[id] || {}
    const partCards = (cards || []).filter(c => String(c.nomenclature_id) === id)
    const partFlow = (flowRows || []).filter(r => String(r.nomenclature_id) === id)
    const partScrap = (scrapRows || []).filter(r => String(r.nomenclature_id) === id)
    const partInv = (invRows || []).filter(r => String(r.nomenclature_id) === id)

    const byStatus = new Map()
    const byOperationStatus = new Map()
    for (const c of partCards) {
      add(byStatus, c.status, c.quantity)
      add(byOperationStatus, `${c.operation || '-'} / ${c.status || '-'}`, c.quantity)
    }

    const shop1Accepted = partCards
      .filter(c => isShop1Op(c.operation) && (c.status === 'completed' || c.status === 'at-shop2-buffer'))
      .reduce((sum, c) => sum + qty(c.quantity), 0)
    const bufferShop2 = partCards
      .filter(c => c.status === 'at-shop2-buffer')
      .reduce((sum, c) => sum + Math.max(0, qty(c.quantity) - qty(c.used_in_shop2_qty)), 0)
    const waitingCut = partCards
      .filter(c => c.operation === 'Розкрій' && ['new', 'waiting-materials', 'waiting-machines'].includes(c.status))
      .reduce((sum, c) => sum + qty(c.quantity), 0)

    const flowSgp = partFlow.filter(r => isSgpStage(r.stage_name)).reduce((sum, r) => sum + qty(r.total_good), 0)
    const flowBz = partFlow.filter(r => isBzStage(r.stage_name)).reduce((sum, r) => sum + qty(r.total_bz), 0)
    const flowScrap = partFlow.reduce((sum, r) => sum + qty(r.total_scrap), 0)
    const scrapTotal = partScrap.length
      ? partScrap.reduce((sum, r) => sum + qty(r.total_scrap), 0)
      : flowScrap

    const stockFromSnapshot = qty(snap.stock)
    const plannedReserve = Math.max(0, qty(snap.sheets) * (qty(snap.units_per_sheet) || 1) + stockFromSnapshot - qty(snap.need))
    const realSgpByFlow = Math.max(0, flowSgp + stockFromSnapshot)
    const realSgpByCards = Math.max(0, shop1Accepted - bufferShop2 + stockFromSnapshot)
    const forecastSum = Math.max(0, realSgpByCards + flowBz + waitingCut + bufferShop2)
    const shortageFromScrap = Math.max(0, scrapTotal - plannedReserve)

    const globalInventory = partInv.map(i => ({
      type: i.type,
      warehouse: i.warehouse,
      total_qty: qty(i.total_qty),
      reserved_qty: qty(i.reserved_qty)
    }))

    result.parts.push({
      id,
      name: part.name,
      need: qty(snap.need),
      stock_from_snapshot: stockFromSnapshot,
      planned_reserve: plannedReserve,
      scrap: scrapTotal,
      shortage_from_scrap: shortageFromScrap,
      shop1_accepted: shop1Accepted,
      buffer_shop2: bufferShop2,
      waiting_cut: waitingCut,
      real_sgp_by_flow: realSgpByFlow,
      real_sgp_by_cards: realSgpByCards,
      flow_bz: flowBz,
      forecast_sum_cards: forecastSum,
      card_status_qty: Object.fromEntries(byStatus),
      operation_status_qty: Object.fromEntries(byOperationStatus),
      global_inventory_not_order_scoped: globalInventory
    })
  }

  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8')
  console.log(`Audit saved to: ${outputPath}`)
  console.log(JSON.stringify(result.parts.map(part => ({
    name: part.name,
    need: part.need,
    sgp: part.real_sgp_by_cards,
    bz: part.flow_bz + part.stock_from_snapshot,
    buffer_shop2: part.buffer_shop2,
    waiting_cut: part.waiting_cut,
    scrap: part.scrap,
    forecast_sum: part.forecast_sum_cards
  })), null, 2))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
