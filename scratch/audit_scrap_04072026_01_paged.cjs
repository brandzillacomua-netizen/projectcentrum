const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'
const asNumber = value => Number(value) || 0
const asId = value => String(value || '')

async function fetchHistoryPaged(cardIds) {
  const rows = []
  const chunkSize = 25
  const pageSize = 1000

  for (let i = 0; i < cardIds.length; i += chunkSize) {
    const chunk = cardIds.slice(i, i + chunkSize)
    for (let from = 0; ; from += pageSize) {
      const to = from + pageSize - 1
      const { data, error } = await supabase
        .from('work_card_history')
        .select('*')
        .in('card_id', chunk)
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      rows.push(...(data || []))
      if (!data || data.length < pageSize) break
    }
  }

  const byId = new Map()
  rows.forEach(row => {
    if (row?.id) byId.set(asId(row.id), row)
  })
  return Array.from(byId.values())
}

function add(map, key, qty) {
  map[key] = (map[key] || 0) + asNumber(qty)
}

function printMap(title, map) {
  console.log(`\n${title}`)
  console.log(`TOTAL=${Object.values(map).reduce((sum, qty) => sum + qty, 0)}`)
  Object.entries(map).sort((a, b) => b[1] - a[1]).forEach(([key, qty]) => {
    console.log(`${key}: ${qty}`)
  })
}

async function main() {
  const { data: orders, error: orderError } = await supabase
    .from('orders')
    .select('id,order_num,customer')
    .eq('order_num', orderNum)
    .limit(1)
  if (orderError) throw orderError
  const order = orders?.[0]
  if (!order) throw new Error(`Order ${orderNum} not found`)

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id,step,status,plan_snapshot,created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  if (taskError) throw taskError
  const taskIds = tasks.map(task => task.id)

  const { data: cards, error: cardError } = await supabase
    .from('work_cards')
    .select('*')
    .in('task_id', taskIds)
    .limit(10000)
  if (cardError) throw cardError

  const history = await fetchHistoryPaged(cards.map(card => card.id))
  const nomIds = [...new Set([
    ...cards.map(card => card.nomenclature_id),
    ...history.map(row => row.nomenclature_id)
  ].filter(Boolean).map(asId))]
  const { data: noms, error: nomError } = nomIds.length
    ? await supabase.from('nomenclatures').select('id,name,type,units_per_sheet').in('id', nomIds)
    : { data: [], error: null }
  if (nomError) throw nomError

  const nomById = new Map((noms || []).map(nom => [asId(nom.id), nom]))
  const cardById = new Map(cards.map(card => [asId(card.id), card]))
  const byNom = {}
  const byNomStage = {}
  const byStage = {}
  const rowsByNom = {}

  const scrapRows = history.filter(row => asNumber(row.scrap_qty) > 0)
  for (const row of scrapRows) {
    const card = cardById.get(asId(row.card_id))
    const nomId = asId(row.nomenclature_id || card?.nomenclature_id)
    const name = nomById.get(nomId)?.name || nomId || 'unknown'
    const stage = row.stage_name || '-'
    const qty = asNumber(row.scrap_qty)
    add(byNom, name, qty)
    add(byStage, stage, qty)
    byNomStage[name] ||= {}
    add(byNomStage[name], stage, qty)
    rowsByNom[name] = (rowsByNom[name] || 0) + 1
  }

  console.log(`ORDER ${order.order_num} | ${order.customer || '-'} | ${order.id}`)
  console.log(`TASKS=${tasks.length} CARDS=${cards.length} HISTORY_ROWS=${history.length} SCRAP_ROWS=${scrapRows.length}`)
  printMap('SCRAP BY DETAIL', byNom)
  printMap('SCRAP BY STAGE', byStage)

  console.log('\nDETAIL STAGES')
  Object.entries(byNom)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, qty]) => {
      const stages = Object.entries(byNomStage[name] || {})
        .sort((a, b) => b[1] - a[1])
        .map(([stage, stageQty]) => `${stage}:${stageQty}`)
        .join(', ')
      console.log(`${name} | scrap=${qty} | rows=${rowsByNom[name]} | ${stages}`)
    })

  console.log('\nTOP 20 SCRAP ROWS')
  scrapRows
    .map(row => {
      const card = cardById.get(asId(row.card_id))
      const nomId = asId(row.nomenclature_id || card?.nomenclature_id)
      return {
        row,
        qty: asNumber(row.scrap_qty),
        name: nomById.get(nomId)?.name || nomId || 'unknown'
      }
    })
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 20)
    .forEach(item => {
      console.log(`${item.name} | qty=${item.qty} | ${item.row.stage_name || '-'} | ${item.row.operator_name || '-'} | ${item.row.completed_at || item.row.created_at || '-'} | history=${item.row.id} | card=${item.row.card_id}`)
    })

  console.log('\nCARDS WITH MULTIPLE SCRAP ROWS ON SAME STAGE')
  const multi = new Map()
  for (const row of scrapRows) {
    const key = `${row.card_id || '-'}|${row.stage_name || '-'}`
    const current = multi.get(key) || { rows: [], total: 0 }
    current.rows.push(row)
    current.total += asNumber(row.scrap_qty)
    multi.set(key, current)
  }
  Array.from(multi.entries())
    .filter(([, item]) => item.rows.length > 1)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .forEach(([key, item]) => {
      const cardId = key.split('|')[0]
      const card = cardById.get(asId(cardId))
      const name = nomById.get(asId(card?.nomenclature_id))?.name || card?.nomenclature_id || 'unknown'
      console.log(`${name} | card=${cardId} | stage=${key.split('|')[1]} | rows=${item.rows.length} | total=${item.total}`)
      item.rows
        .sort((a, b) => new Date(a.completed_at || a.created_at || 0) - new Date(b.completed_at || b.created_at || 0))
        .forEach(row => console.log(`  qty=${row.scrap_qty} | ${row.operator_name || '-'} | ${row.completed_at || row.created_at || '-'} | history=${row.id}`))
    })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
