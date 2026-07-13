const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const TARGET_NAMES = [
  'KH-10(210)-Х-4-109',
  'KH-10(210)-X-4-109'
]
const TARGET_IDS = [
  'c93b2a4f-580b-41bc-8c16-97b293f9e6aa', // Cyrillic Х
  '43f406fa-faa3-4a17-994f-cfeaddc701d0', // Latin X
  'dc154eb4-a568-4944-8608-9cb0dae1180e'  // Older/observed KH-10(210)-Х-4-109 id
]

const n = value => Number(value) || 0
const s = value => String(value || '')
const key = value => s(value)
const producedStatuses = new Set(['completed', 'at-shop2-buffer', 'at-buffer', 'waiting-buffer'])

function add(map, mapKey, qty) {
  const k = mapKey || '-'
  map[k] = (map[k] || 0) + n(qty)
}

function groupQty(rows, keyFn, qtyFn = row => row.quantity) {
  const out = {}
  for (const row of rows || []) add(out, keyFn(row), qtyFn(row))
  return out
}

function printMap(title, map) {
  console.log(`\n${title}`)
  Object.entries(map || {})
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .forEach(([k, v]) => console.log(`  ${k}: ${v}`))
}

async function must(label, query) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data || []
}

async function fetchByChunks(table, select, column, values, chunkSize = 80) {
  const rows = []
  const unique = [...new Set((values || []).filter(Boolean).map(key))]
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize)
    const data = await must(
      `${table}.${column}`,
      supabase.from(table).select(select).in(column, chunk).limit(10000)
    )
    rows.push(...data)
  }
  return rows
}

function parseRedoSource(cardInfo) {
  const info = s(cardInfo)
  const match = info.match(/\[REDO_FOR:([^\]]+)\]/i) || info.match(/\[REISSUE_FOR:([^\]]+)\]/i)
  return match ? match[1] : ''
}

function eventTime(row) {
  return row.completed_at || row.created_at || row.updated_at || ''
}

async function main() {
  const allNoms = await must(
    'nomenclatures',
    supabase
      .from('nomenclatures')
      .select('id,name,type,units_per_sheet,material_type')
      .in('id', TARGET_IDS)
      .limit(100)
  )

  const targetNoms = allNoms.filter(nom => TARGET_NAMES.includes(nom.name) || TARGET_IDS.includes(nom.id))
  if (targetNoms.length === 0) {
    console.log('No exact target nomenclature found.')
    console.log(allNoms)
    return
  }

  const targetIds = targetNoms.map(nom => nom.id)
  const nomById = new Map(targetNoms.map(nom => [key(nom.id), nom]))

  const cards = await fetchByChunks(
    'work_cards',
    'id,task_id,order_id,nomenclature_id,quantity,operation,status,is_rework,card_info,machine,created_at,started_at,completed_at,operator_name',
    'nomenclature_id',
    targetIds
  )

  const taskIds = [...new Set(cards.map(card => card.task_id).filter(Boolean))]
  const orderIds = [...new Set(cards.map(card => card.order_id).filter(Boolean))]

  const tasks = await fetchByChunks(
    'tasks',
    'id,order_id,step,status,planned_sets,plan_snapshot,machine_name,created_at,completed_at,batch_index',
    'id',
    taskIds
  )
  const orders = await fetchByChunks(
    'orders',
    'id,order_num,customer,status,quantity,nomenclature_id,created_at,order_items(*)',
    'id',
    orderIds
  )
  const history = await fetchByChunks(
    'work_card_history',
    'id,card_id,nomenclature_id,stage_name,operator_name,qty_at_start,qty_completed,scrap_qty,card_info,started_at,completed_at,created_at,is_archived_scrap',
    'card_id',
    cards.map(card => card.id)
  )
  const totals = await fetchByChunks(
    'work_card_scrap_totals',
    'id,card_id,task_id,order_id,nomenclature_id,total_scrap,first_scrap_at,last_scrap_at,updated_at',
    'nomenclature_id',
    targetIds
  )
  const inventory = await fetchByChunks(
    'inventory',
    'id,nomenclature_id,name,type,warehouse,total_qty,reserved_qty,pocket_owner,updated_at',
    'nomenclature_id',
    targetIds
  )

  const taskById = new Map(tasks.map(task => [key(task.id), task]))
  const orderById = new Map(orders.map(order => [key(order.id), order]))
  const cardById = new Map(cards.map(card => [key(card.id), card]))

  const scrapRows = history.filter(row => n(row.scrap_qty) > 0)
  const historyScrapTotal = scrapRows.reduce((sum, row) => sum + n(row.scrap_qty), 0)
  const lightScrapTotal = totals.reduce((sum, row) => sum + n(row.total_scrap), 0)

  console.log('TARGET NOMENCLATURES')
  for (const nom of targetNoms) {
    console.log(`  ${nom.id} | ${nom.name} | units/sheet=${n(nom.units_per_sheet)} | material=${nom.material_type || '-'}`)
  }
  if (allNoms.length !== targetNoms.length) {
    console.log('\nSIMILAR NOMENCLATURES')
    for (const nom of allNoms.filter(nom => !TARGET_NAMES.includes(nom.name))) {
      console.log(`  ${nom.id} | ${nom.name} | units/sheet=${n(nom.units_per_sheet)} | type=${nom.type}`)
    }
  }

  console.log(`\nRAW COUNTS: cards=${cards.length}, tasks=${tasks.length}, orders=${orders.length}, history=${history.length}, scrapRows=${scrapRows.length}, lightRows=${totals.length}, inventoryRows=${inventory.length}`)
  console.log(`SCRAP CHECK: history=${historyScrapTotal}, work_card_scrap_totals=${lightScrapTotal}, diff=${lightScrapTotal - historyScrapTotal}`)

  printMap('INVENTORY BY TYPE/WAREHOUSE', groupQty(inventory, row => `${row.type || '-'} / ${row.warehouse || '-'} / owner=${row.pocket_owner || '-'}`, row => n(row.total_qty)))
  printMap('CARDS BY STATUS', groupQty(cards, row => row.status, row => n(row.quantity)))
  printMap('CARDS BY OPERATION/STATUS', groupQty(cards, row => `${row.operation || '-'} / ${row.status || '-'}`, row => n(row.quantity)))
  printMap('SCRAP BY STAGE', groupQty(scrapRows, row => row.stage_name, row => n(row.scrap_qty)))
  printMap('SCRAP BY OPERATOR', groupQty(scrapRows, row => row.operator_name, row => n(row.scrap_qty)))

  const cardsByTask = new Map()
  for (const card of cards) {
    const id = key(card.task_id)
    if (!cardsByTask.has(id)) cardsByTask.set(id, [])
    cardsByTask.get(id).push(card)
  }

  console.log('\nBY TASK / ORDER')
  for (const [taskId, taskCards] of [...cardsByTask.entries()].sort((a, b) => {
    const ao = orderById.get(key(taskById.get(a[0])?.order_id))?.order_num || ''
    const bo = orderById.get(key(taskById.get(b[0])?.order_id))?.order_num || ''
    return ao.localeCompare(bo) || s(taskById.get(a[0])?.created_at).localeCompare(s(taskById.get(b[0])?.created_at))
  })) {
    const task = taskById.get(taskId)
    const order = orderById.get(key(task?.order_id))
    const taskHistory = scrapRows.filter(row => key(cardById.get(key(row.card_id))?.task_id) === taskId)
    const taskTotals = totals.filter(row => key(row.task_id) === taskId)
    const nomId = key(taskCards[0]?.nomenclature_id)
    const nom = nomById.get(nomId)
    const snapshot = task?.plan_snapshot?.[nomId] || {}
    const need = n(snapshot.need)
    const stock = n(snapshot.stock)
    const plannedSheets = n(snapshot.sheets)
    const unitsPerSheet = n(snapshot.units_per_sheet || nom?.units_per_sheet || 1) || 1
    const producedQty = taskCards
      .filter(card => producedStatuses.has(card.status))
      .reduce((sum, card) => sum + n(card.quantity), 0)
    const activeQty = taskCards
      .filter(card => !producedStatuses.has(card.status))
      .reduce((sum, card) => sum + n(card.quantity), 0)
    const redoQty = taskCards
      .filter(card => card.is_rework || s(card.card_info).includes('[REDO]') || s(card.card_info).includes('Довипуск'))
      .reduce((sum, card) => sum + n(card.quantity), 0)
    const actualSheets = taskCards.reduce((sum, card) => {
      const explicit = n(card.actual_sheets)
      if (explicit > 0) return sum + explicit
      if (s(card.operation).toLowerCase().includes('склад')) return sum
      return sum + Math.ceil(n(card.quantity) / unitsPerSheet)
    }, 0)
    const totalSheets = Math.max(plannedSheets, actualSheets)
    const spareFromSheets = need > 0 ? (totalSheets * unitsPerSheet) + stock - need : 0
    const scrapHistory = taskHistory.reduce((sum, row) => sum + n(row.scrap_qty), 0)
    const scrapLight = taskTotals.reduce((sum, row) => sum + n(row.total_scrap), 0)
    const shortage = Math.max(0, scrapLight - spareFromSheets)

    console.log(`  ${order?.order_num || '-'} | ${task?.step || '-'} | taskStatus=${task?.status || '-'} | task=${taskId}`)
    console.log(`    need=${need}, produced=${producedQty}, active=${activeQty}, cards=${taskCards.length}, redoQty=${redoQty}`)
    console.log(`    sheets planned=${plannedSheets}, estimatedActual=${actualSheets}, units/sheet=${unitsPerSheet}, stock=${stock}, spareFromSheets=${spareFromSheets}`)
    console.log(`    scrap history=${scrapHistory}, light=${scrapLight}, shortageByForemanMath=${shortage}`)
    console.log(`    statuses=${JSON.stringify(groupQty(taskCards, c => c.status, c => n(c.quantity)))}`)
  }

  console.log('\nTOP SCRAP EVENTS')
  scrapRows
    .slice()
    .sort((a, b) => n(b.scrap_qty) - n(a.scrap_qty) || s(eventTime(b)).localeCompare(s(eventTime(a))))
    .slice(0, 40)
    .forEach(row => {
      const card = cardById.get(key(row.card_id))
      const task = taskById.get(key(card?.task_id))
      const order = orderById.get(key(task?.order_id))
      console.log(`  qty=${n(row.scrap_qty)} | ${eventTime(row) || '-'} | order=${order?.order_num || '-'} | ${row.stage_name || '-'} | ${row.operator_name || '-'} | card=${s(row.card_id).slice(0, 8)} | cardQty=${n(card?.quantity)} | status=${card?.status || '-'}`)
    })

  const redoCards = cards.filter(card => card.is_rework || s(card.card_info).includes('[REDO]') || s(card.card_info).includes('Довипуск'))
  console.log('\nREISSUE / REDO CARDS')
  redoCards
    .sort((a, b) => s(a.created_at).localeCompare(s(b.created_at)))
    .forEach(card => {
      const task = taskById.get(key(card.task_id))
      const order = orderById.get(key(task?.order_id))
      console.log(`  ${order?.order_num || '-'} | qty=${n(card.quantity)} | status=${card.status || '-'} | op=${card.operation || '-'} | source=${parseRedoSource(card.card_info) || '-'} | id=${card.id}`)
    })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
