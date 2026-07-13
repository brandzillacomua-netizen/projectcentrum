const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'
const asNumber = value => Number(value) || 0
const asId = value => String(value || '')

async function fetchHistory(cardIds) {
  const rows = []
  for (let i = 0; i < cardIds.length; i += 100) {
    const { data, error } = await supabase
      .from('work_card_history')
      .select('*')
      .in('card_id', cardIds.slice(i, i + 100))
      .limit(10000)
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

function groupScrap(rows, nomById, cardById) {
  const map = {}
  for (const row of rows || []) {
    const qty = asNumber(row.scrap_qty)
    if (qty <= 0) continue
    const card = cardById?.get(asId(row.card_id))
    const nomId = asId(row.nomenclature_id || card?.nomenclature_id)
    const name = nomById.get(nomId)?.name || nomId || 'unknown'
    map[name] = (map[name] || 0) + qty
  }
  return map
}

function printMap(title, map) {
  console.log(`\n${title}`)
  const total = Object.values(map).reduce((sum, qty) => sum + qty, 0)
  console.log(`TOTAL=${total}`)
  Object.entries(map).sort((a, b) => b[1] - a[1]).forEach(([name, qty]) => {
    console.log(`${name}: ${qty}`)
  })
}

async function main() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id,order_num')
    .eq('order_num', orderNum)
    .limit(1)
  if (orderError) throw orderError
  const order = orders?.[0]
  if (!order) throw new Error('Order not found')

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id,step,status,plan_snapshot,created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  if (taskError) throw taskError
  const cuttingTask = tasks.find(task => String(task.step || '').includes('Розкрій')) || tasks[0]

  const { data: cards, error: cardError } = await supabase
    .from('work_cards')
    .select('*')
    .eq('task_id', cuttingTask.id)
    .limit(10000)
  if (cardError) throw cardError

  const liveHistory = await fetchHistory(cards.map(card => card.id))
  const snapshot = cuttingTask.plan_snapshot?._report_snapshot
  const snapshotRows = snapshot?.historyRows || []
  const snapshotCards = snapshot?.taskCards || []

  const nomIds = [...new Set([
    ...cards.map(card => card.nomenclature_id),
    ...liveHistory.map(row => row.nomenclature_id),
    ...snapshotRows.map(row => row.nomenclature_id),
    ...snapshotCards.map(card => card.nomenclature_id)
  ].filter(Boolean).map(asId))]
  const { data: noms, error: nomError } = nomIds.length
    ? await supabase.from('nomenclatures').select('id,name').in('id', nomIds)
    : { data: [], error: null }
  if (nomError) throw nomError

  const nomById = new Map((noms || []).map(nom => [asId(nom.id), nom]))
  const cardById = new Map(cards.map(card => [asId(card.id), card]))

  console.log(`ORDER=${order.order_num}`)
  console.log(`TASK=${cuttingTask.id} | ${cuttingTask.step} | ${cuttingTask.status} | created=${cuttingTask.created_at}`)
  console.log(`LIVE cards=${cards.length} history=${liveHistory.length} scrapRows=${liveHistory.filter(row => asNumber(row.scrap_qty) > 0).length}`)
  console.log(`SNAPSHOT exists=${Boolean(snapshot)} cards=${snapshotCards.length} history=${snapshotRows.length} scrapRows=${snapshotRows.filter(row => asNumber(row.scrap_qty) > 0).length}`)

  printMap('LIVE SCRAP', groupScrap(liveHistory, nomById, cardById))
  printMap('SNAPSHOT SCRAP', groupScrap(snapshotRows, nomById, cardById))

  const liveIds = new Set(liveHistory.map(row => asId(row.id)))
  const snapIds = new Set(snapshotRows.map(row => asId(row.id)))
  const missingFromSnapshot = liveHistory.filter(row => asNumber(row.scrap_qty) > 0 && !snapIds.has(asId(row.id)))
  const onlySnapshot = snapshotRows.filter(row => asNumber(row.scrap_qty) > 0 && !liveIds.has(asId(row.id)))

  printMap('LIVE SCRAP MISSING FROM SNAPSHOT', groupScrap(missingFromSnapshot, nomById, cardById))
  printMap('SNAPSHOT SCRAP NOT IN LIVE IDS', groupScrap(onlySnapshot, nomById, cardById))
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
