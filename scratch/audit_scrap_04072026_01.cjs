const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'
const asNumber = value => Number(value) || 0
const asId = value => String(value || '')
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''))

const producedStatuses = new Set(['completed', 'at-shop2-buffer', 'at-buffer', 'waiting-buffer'])
const countAsProduced = card => producedStatuses.has(card?.status)
const isBufferCard = card => {
  const op = String(card?.operation || '').toLowerCase()
  return op.includes('склад бз') || op.includes('склад bz') || op.includes('РЎРєР»Р°Рґ Р‘Р—'.toLowerCase())
}
const isRedoCard = card => card?.is_rework || String(card?.card_info || '').includes('[REDO]')

async function fetchHistory(cardIds) {
  const rows = []
  for (let i = 0; i < cardIds.length; i += 100) {
    const chunk = cardIds.slice(i, i + 100)
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

function add(map, key, qty) {
  map[key] = (map[key] || 0) + asNumber(qty)
}

async function main() {
  const { data: orderRows, error: orderError } = await supabase
    .from('orders')
    .select('id,order_num,customer')
    .eq('order_num', orderNum)
    .limit(1)
  if (orderError) throw orderError
  const order = orderRows?.[0]
  if (!order) throw new Error(`Order ${orderNum} not found`)

  const { data: tasks, error: taskError } = await supabase
    .from('tasks')
    .select('id,step,status,planned_sets,plan_snapshot,machine_name,created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  if (taskError) throw taskError

  const taskIds = (tasks || []).map(task => task.id)
  const { data: cards, error: cardError } = await supabase
    .from('work_cards')
    .select('*')
    .in('task_id', taskIds)
    .order('created_at', { ascending: true })
  if (cardError) throw cardError

  const history = await fetchHistory((cards || []).map(card => card.id))
  const nomIds = [...new Set([
    ...cards.map(card => card.nomenclature_id),
    ...history.map(row => row.nomenclature_id),
    ...tasks.flatMap(task => Object.keys(task.plan_snapshot || {}))
  ].filter(Boolean).map(asId).filter(isUuid))]

  const { data: noms, error: nomError } = nomIds.length
    ? await supabase.from('nomenclatures').select('id,name,type,units_per_sheet').in('id', nomIds)
    : { data: [], error: null }
  if (nomError) throw nomError

  const nomById = new Map((noms || []).map(nom => [asId(nom.id), nom]))
  const cardById = new Map(cards.map(card => [asId(card.id), card]))
  const taskById = new Map(tasks.map(task => [asId(task.id), task]))

  const scrapRows = history
    .filter(row => asNumber(row.scrap_qty) > 0)
    .map(row => {
      const card = cardById.get(asId(row.card_id))
      const nomId = asId(row.nomenclature_id || card?.nomenclature_id)
      return { ...row, card, task: taskById.get(asId(card?.task_id)), nomId, qty: asNumber(row.scrap_qty) }
    })

  const byNom = {}
  const byNomStage = {}
  const byNomRows = {}
  const byNomTopEvents = {}
  for (const row of scrapRows) {
    const nomName = nomById.get(row.nomId)?.name || row.nomId || 'unknown'
    add(byNom, nomName, row.qty)
    byNomStage[nomName] ||= {}
    add(byNomStage[nomName], row.stage_name || '-', row.qty)
    byNomRows[nomName] = (byNomRows[nomName] || 0) + 1
    byNomTopEvents[nomName] ||= []
    byNomTopEvents[nomName].push(row)
  }

  const parts = []
  for (const task of tasks) {
    const snapshot = task.plan_snapshot || {}
    for (const [nomId, snap] of Object.entries(snapshot)) {
      if (!isUuid(nomId)) continue
      const nom = nomById.get(asId(nomId))
      if (nom?.type !== 'part') continue

      const nomCards = cards.filter(card => asId(card.task_id) === asId(task.id) && asId(card.nomenclature_id) === asId(nomId))
      const productionCards = nomCards.filter(card => !isBufferCard(card))
      const cardScrap = {}
      for (const row of scrapRows.filter(row => asId(row.nomId) === asId(nomId))) {
        add(cardScrap, asId(row.card_id), row.qty)
      }

      const unitsPerSheet = Math.max(1, asNumber(snap.units_per_sheet || nom.units_per_sheet || 1))
      const actualSheets = productionCards.reduce((sum, card) => {
        const explicit = asNumber(card.actual_sheets || card.actualSheets)
        if (explicit > 0) return sum + explicit
        return sum + Math.ceil((asNumber(card.quantity) + asNumber(cardScrap[asId(card.id)])) / unitsPerSheet)
      }, 0)
      const plannedSheets = asNumber(snap.sheets)
      const totalSheets = productionCards.length > 0 ? Math.max(plannedSheets, actualSheets) : plannedSheets
      const need = asNumber(snap.need)
      const stock = asNumber(snap.stock)
      const spareFromSheets = (totalSheets * unitsPerSheet) + stock - need
      const scrap = asNumber(byNom[nom.name])
      const shortage = Math.max(0, scrap - spareFromSheets)
      const produced = nomCards.filter(countAsProduced).reduce((sum, card) => sum + asNumber(card.quantity), 0)
      const redoQty = nomCards.filter(isRedoCard).reduce((sum, card) => sum + asNumber(card.quantity), 0)

      parts.push({
        task: task.step,
        name: nom.name,
        need,
        produced,
        scrap,
        plannedSheets,
        actualSheets,
        spareFromSheets,
        shortage,
        cards: nomCards.length,
        redoCards: nomCards.filter(isRedoCard).length,
        redoQty
      })
    }
  }

  console.log(`ORDER ${order.order_num} | ${order.customer || '-'} | ${order.id}`)
  console.log(`TASKS ${tasks.length} | CARDS ${cards.length} | HISTORY ${history.length} | SCRAP_ROWS ${scrapRows.length}`)
  console.log(`TOTAL_FACT_SCRAP ${scrapRows.reduce((sum, row) => sum + row.qty, 0)}`)

  console.log('\nFACT SCRAP BY DETAIL')
  Object.entries(byNom)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, qty]) => {
      const stages = Object.entries(byNomStage[name] || {})
        .sort((a, b) => b[1] - a[1])
        .map(([stage, stageQty]) => `${stage}:${stageQty}`)
        .join(', ')
      console.log(`${name} | scrap=${qty} | rows=${byNomRows[name]} | ${stages}`)
    })

  console.log('\nFOREMAN SHORTAGE MATH')
  parts
    .sort((a, b) => b.scrap - a.scrap)
    .forEach(part => {
      console.log(`${part.name} | need=${part.need} | produced=${part.produced} | cards=${part.cards} | scrap=${part.scrap} | spare=${part.spareFromSheets} | shortage=${part.shortage} | sheets=${part.actualSheets}/${part.plannedSheets} | redo=${part.redoCards} cards, qty=${part.redoQty}`)
    })

  console.log('\nTOP SCRAP EVENTS BY DETAIL')
  Object.entries(byNomTopEvents)
    .sort((a, b) => (byNom[b[0]] || 0) - (byNom[a[0]] || 0))
    .forEach(([name, rows]) => {
      rows
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5)
        .forEach(row => {
          const time = row.completed_at || row.created_at || '-'
          console.log(`${name} | qty=${row.qty} | ${row.stage_name || '-'} | ${row.operator_name || '-'} | ${time} | card=${row.card_id}`)
        })
    })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
