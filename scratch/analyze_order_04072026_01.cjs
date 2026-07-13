const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'

const by = (items, keyFn, qtyFn = () => 1) => {
  const out = {}
  for (const item of items) {
    const key = keyFn(item) || 'Не вказано'
    out[key] = (out[key] || 0) + qtyFn(item)
  }
  return out
}

const printMap = (title, map) => {
  console.log(`\n${title}`)
  Object.entries(map)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))
    .forEach(([key, value]) => console.log(`  ${key}: ${value}`))
}

async function fetchAllHistory(cardIds) {
  const rows = []
  const chunkSize = 100
  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('work_card_history')
      .select('*')
      .in('card_id', chunk)
      .limit(10000)
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

async function run() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id, order_num, customer, quantity, nomenclature_id, order_items(*)')
    .eq('order_num', orderNum)
  if (orderError) throw orderError
  if (!orders?.length) throw new Error(`Order ${orderNum} not found`)

  const order = orders[0]
  console.log(`Order ${order.order_num} | ${order.customer || ''} | id=${order.id}`)

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id, order_id, step, status, machine_name, planned_sets, plan_snapshot, created_at, completed_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  if (taskError) throw taskError
  console.log(`Tasks: ${tasks?.length || 0}`)
  ;(tasks || []).forEach(t => console.log(`  ${t.id} | ${t.step} | ${t.status} | machine=${t.machine_name || '-'} | planned=${t.planned_sets || 0}`))

  const taskIds = (tasks || []).map(t => t.id)
  if (taskIds.length === 0) return

  const { data: cards, error: cardError } = await supabase
    .from('work_cards')
    .select('*')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true })
  if (cardError) throw cardError
  console.log(`Cards: ${cards?.length || 0}`)

  const cardIds = (cards || []).map(c => c.id)
  const history = cardIds.length ? await fetchAllHistory(cardIds) : []
  console.log(`History rows: ${history.length}`)

  const nomIds = [...new Set([
    ...(cards || []).map(c => c.nomenclature_id),
    ...history.map(h => h.nomenclature_id)
  ].filter(Boolean))]
  const { data: noms, error: nomError } = nomIds.length
    ? await supabase.from('nomenclatures').select('id, name, type, units_per_sheet').in('id', nomIds)
    : { data: [], error: null }
  if (nomError) throw nomError

  const cardById = new Map((cards || []).map(c => [String(c.id), c]))
  const nomById = new Map((noms || []).map(n => [String(n.id), n]))
  const scrapRows = history.filter(h => (Number(h.scrap_qty) || 0) > 0)
  const totalScrap = scrapRows.reduce((sum, h) => sum + (Number(h.scrap_qty) || 0), 0)

  console.log(`\nTOTAL SCRAP: ${totalScrap}`)
  printMap('Scrap by stage:', by(scrapRows, h => h.stage_name, h => Number(h.scrap_qty) || 0))
  printMap('Scrap by operator:', by(scrapRows, h => h.operator_name, h => Number(h.scrap_qty) || 0))
  printMap('Scrap by task:', by(scrapRows, h => {
    const card = cardById.get(String(h.card_id))
    const task = tasks.find(t => String(t.id) === String(card?.task_id))
    return `${task?.step || 'Task'} (${card?.task_id || 'no-card'})`
  }, h => Number(h.scrap_qty) || 0))
  printMap('Scrap by detail:', by(scrapRows, h => {
    const card = cardById.get(String(h.card_id))
    const nomId = h.nomenclature_id || card?.nomenclature_id
    return nomById.get(String(nomId))?.name || nomId
  }, h => Number(h.scrap_qty) || 0))

  console.log('\nScrap events:')
  scrapRows
    .sort((a, b) => new Date(a.completed_at || a.created_at || 0) - new Date(b.completed_at || b.created_at || 0))
    .forEach(h => {
      const card = cardById.get(String(h.card_id))
      const nom = nomById.get(String(h.nomenclature_id || card?.nomenclature_id))
      console.log(`  ${h.completed_at || h.created_at || '-'} | qty=${h.scrap_qty} | ${h.stage_name || '-'} | ${h.operator_name || '-'} | ${nom?.name || h.nomenclature_id || card?.nomenclature_id || '-'} | card=${h.card_id}`)
    })

  const reworkCards = (cards || []).filter(c => c.is_rework || String(c.card_info || '').includes('[REDO]'))
  console.log(`\nRework/redo cards: ${reworkCards.length}`)
  reworkCards.forEach(c => {
    const nom = nomById.get(String(c.nomenclature_id))
    console.log(`  qty=${Number(c.quantity) || 0} | status=${c.status} | ${nom?.name || c.nomenclature_id} | ${c.card_info || ''} | id=${c.id}`)
  })

  const zeroCards = reworkCards.filter(c => (Number(c.quantity) || 0) <= 0)
  if (zeroCards.length > 0) {
    console.log(`\nZERO-QTY REWORK CARDS: ${zeroCards.length}`)
    zeroCards.forEach(c => console.log(`  ${c.id} | ${c.card_info || ''}`))
  }
}

run().catch(error => {
  console.error(error)
  process.exit(1)
})
