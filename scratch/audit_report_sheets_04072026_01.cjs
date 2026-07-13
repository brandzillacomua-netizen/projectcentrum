const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'
const num = v => Number(v) || 0
const str = v => String(v || '')

async function must(label, query) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data || []
}

async function fetchHistory(cardIds) {
  const rows = []
  for (let i = 0; i < cardIds.length; i += 80) {
    const ids = cardIds.slice(i, i + 80)
    rows.push(...await must('work_card_history', supabase
      .from('work_card_history')
      .select('id,card_id,nomenclature_id,stage_name,operator_name,qty_at_start,qty_completed,scrap_qty,cutters_used,card_info,completed_at,created_at')
      .in('card_id', ids)
      .limit(10000)
    ))
  }
  return rows
}

function isCutting(row) {
  return str(row.stage_name).trim() === 'Розкрій'
}

function isRedo(card) {
  const info = str(card.card_info)
  return card.is_rework || info.includes('[REDO]') || info.toLowerCase().includes('довипуск')
}

function parseCuttersBreakdown(cardInfo = '') {
  const info = String(cardInfo || '')
  const markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
  if (markerIdx === -1) return null
  const jsonStart = info.indexOf('{', markerIdx)
  if (jsonStart === -1) return null
  let depth = 0
  let jsonEnd = -1
  for (let i = jsonStart; i < info.length; i++) {
    if (info[i] === '{') depth++
    else if (info[i] === '}') {
      depth--
      if (depth === 0) {
        jsonEnd = i
        break
      }
    }
  }
  if (jsonEnd === -1) return null
  try {
    return JSON.parse(info.slice(jsonStart, jsonEnd + 1))
  } catch {
    return null
  }
}

function summarizeActualCutters(label, history) {
  const cuttingRows = (history || []).filter(isCutting)
  const breakdown = {}
  let rowsWithBreakdown = 0
  let rowsWithCuttersUsed = 0
  let rowsWithoutCutterFact = 0
  let cuttersUsedFallbackTotal = 0

  for (const row of cuttingRows) {
    const parsed = parseCuttersBreakdown(row.card_info)
    if (parsed) {
      rowsWithBreakdown++
      for (const [name, qty] of Object.entries(parsed)) {
        breakdown[name] = (breakdown[name] || 0) + num(qty)
      }
    } else if (num(row.cutters_used) > 0) {
      rowsWithCuttersUsed++
      cuttersUsedFallbackTotal += num(row.cutters_used)
      breakdown['Фреза (без деталізації)'] = (breakdown['Фреза (без деталізації)'] || 0) + num(row.cutters_used)
    } else {
      rowsWithoutCutterFact++
    }
  }

  const total = Object.values(breakdown).reduce((sum, qty) => sum + qty, 0)
  console.log(`\n${label} CUTTERS FACT`)
  console.log(`cuttingRows=${cuttingRows.length}, withBreakdown=${rowsWithBreakdown}, withCuttersUsedOnly=${rowsWithCuttersUsed}, withoutCutterFact=${rowsWithoutCutterFact}`)
  console.log(`totalActualCutters=${total}, cuttersUsedFallbackTotal=${cuttersUsedFallbackTotal}`)
  Object.entries(breakdown)
    .sort((a, b) => b[1] - a[1])
    .forEach(([name, qty]) => console.log(`  ${name}: ${qty}`))
}

function calculateReportFormula({ label, snapshot, cards, history, noms }) {
  const nomById = new Map(noms.map(n => [str(n.id), n]))
  const cardById = new Map(cards.map(c => [str(c.id), c]))
  const partIds = Object.keys(snapshot || {}).filter(k =>
    !k.startsWith('_') &&
    !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(k)
  )
  const rows = []
  const materialTotals = {}

  for (const nomId of partIds) {
    const snap = snapshot[nomId] || {}
    const nom = nomById.get(str(nomId))
    if (nom && nom.type !== 'part') continue

    const unitsPerSheet = num(snap.units_per_sheet) || num(nom?.units_per_sheet) || 1
    const plannedSheets = num(snap.sheets)
    const material = snap.material || nom?.material_type || '-'
    const partHistory = history.filter(h => str(h.nomenclature_id) === str(nomId))
    const cuttingHistory = partHistory.filter(isCutting)
    const totalQtyDone = cuttingHistory.reduce((sum, h) => sum + num(h.qty_completed), 0)
    const sheetsDoneByReport = unitsPerSheet > 0 ? Math.ceil(totalQtyDone / unitsPerSheet) : 0

    const partCards = cards.filter(c => str(c.nomenclature_id) === str(nomId))
    const redoCards = partCards.filter(isRedo)
    const cardQty = partCards.reduce((sum, c) => sum + num(c.quantity), 0)
    const redoQty = redoCards.reduce((sum, c) => sum + num(c.quantity), 0)
    const redoSheetsByQty = unitsPerSheet > 0 ? Math.ceil(redoQty / unitsPerSheet) : 0
    const cardSheetsByQty = unitsPerSheet > 0 ? partCards.reduce((sum, c) => sum + Math.ceil(num(c.quantity) / unitsPerSheet), 0) : 0

    const isDefaultT700 = material.toLowerCase().includes('т700') || material.toLowerCase().includes('t700')
    const plannedT300 = snap.sheets_t300 !== undefined ? num(snap.sheets_t300) : (isDefaultT700 ? 0 : plannedSheets)
    const plannedT700 = snap.sheets_t700 !== undefined ? num(snap.sheets_t700) : (isDefaultT700 ? plannedSheets : 0)
    const totalPlanned = plannedT300 + plannedT700
    const actualT300 = totalPlanned > 0 ? Math.round(sheetsDoneByReport * (plannedT300 / totalPlanned)) : sheetsDoneByReport
    const actualT700 = totalPlanned > 0 ? Math.round(sheetsDoneByReport * (plannedT700 / totalPlanned)) : 0

    const row = {
      nomId,
      name: nom?.name || nomId,
      material,
      unitsPerSheet,
      plannedSheets,
      plannedT300,
      plannedT700,
      actualT300,
      actualT700,
      totalQtyDone,
      sheetsDoneByReport,
      delta: sheetsDoneByReport - plannedSheets,
      cards: partCards.length,
      cardQty,
      cardSheetsByQty,
      redoCards: redoCards.length,
      redoQty,
      redoSheetsByQty,
      cuttingRows: cuttingHistory.length
    }
    rows.push(row)

    const matKey = material
    if (!materialTotals[matKey]) materialTotals[matKey] = { plan: 0, fact: 0, planT300: 0, factT300: 0, planT700: 0, factT700: 0 }
    materialTotals[matKey].plan += plannedSheets
    materialTotals[matKey].fact += sheetsDoneByReport
    materialTotals[matKey].planT300 += plannedT300
    materialTotals[matKey].factT300 += actualT300
    materialTotals[matKey].planT700 += plannedT700
    materialTotals[matKey].factT700 += actualT700
  }

  console.log(`\n=== ${label} REPORT FORMULA ===`)
  rows
    .sort((a, b) => b.delta - a.delta || b.sheetsDoneByReport - a.sheetsDoneByReport)
    .forEach(r => {
      console.log(`${r.name}`)
      console.log(`  material=${r.material} | planSheets=${r.plannedSheets} | factByReport=${r.sheetsDoneByReport} | delta=${r.delta}`)
      console.log(`  split plan T300/T700=${r.plannedT300}/${r.plannedT700} | fact T300/T700=${r.actualT300}/${r.actualT700}`)
      console.log(`  cutQty=${r.totalQtyDone} / unitsPerSheet=${r.unitsPerSheet} | cards=${r.cards} cardQty=${r.cardQty} cardSheetsByQty=${r.cardSheetsByQty}`)
      console.log(`  redoCards=${r.redoCards} redoQty=${r.redoQty} redoSheetsByQty=${r.redoSheetsByQty} | cuttingRows=${r.cuttingRows}`)
    })

  console.log(`\n${label} MATERIAL TOTALS`)
  Object.entries(materialTotals).forEach(([mat, v]) => {
    console.log(`${mat}: plan=${v.plan}, fact=${v.fact}, delta=${v.fact - v.plan}, T300 ${v.planT300}/${v.factT300}, T700 ${v.planT700}/${v.factT700}`)
  })
  console.log(`${label} TOTAL: plan=${Object.values(materialTotals).reduce((s, v) => s + v.plan, 0)}, fact=${Object.values(materialTotals).reduce((s, v) => s + v.fact, 0)}`)

  return { rows, materialTotals, cardById, nomById }
}

async function main() {
  const [order] = await must('orders', supabase
    .from('orders')
    .select('id,order_num,customer')
    .eq('order_num', orderNum)
    .limit(1)
  )
  if (!order) throw new Error(`Order ${orderNum} not found`)

  const tasks = await must('tasks', supabase
    .from('tasks')
    .select('id,order_id,step,status,plan_snapshot,created_at,completed_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  )
  const cuttingTask = tasks.find(t => str(t.step).includes('Розкрій'))
  if (!cuttingTask) throw new Error('Cutting task not found')

  const cards = await must('work_cards', supabase
    .from('work_cards')
    .select('id,task_id,order_id,nomenclature_id,quantity,operation,status,is_rework,card_info,machine,created_at,completed_at')
    .eq('task_id', cuttingTask.id)
    .limit(10000)
  )
  const history = await fetchHistory(cards.map(c => c.id))

  const snapshot = cuttingTask.plan_snapshot || {}
  const partIds = Object.keys(snapshot).filter(k =>
    !k.startsWith('_') &&
    !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(k)
  )

  const nomIds = [...new Set([
    ...partIds,
    ...cards.map(c => c.nomenclature_id),
    ...history.map(h => h.nomenclature_id)
  ].filter(Boolean))]

  const noms = await must('nomenclatures', supabase
    .from('nomenclatures')
    .select('id,name,type,units_per_sheet,material_type')
    .in('id', nomIds)
    .limit(10000)
  )
  const nomById = new Map(noms.map(n => [str(n.id), n]))
  const cardById = new Map(cards.map(c => [str(c.id), c]))

  console.log(`ORDER ${order.order_num} | task=${cuttingTask.id} | ${cuttingTask.step} | cards=${cards.length} | history=${history.length}`)
  console.log('REPORT FORMULA: sheetsDone = ceil(sum(cutting history qty_completed) / units_per_sheet)')
  const live = calculateReportFormula({ label: 'LIVE', snapshot, cards, history, noms })
  summarizeActualCutters('LIVE', history)

  const cached = snapshot._report_snapshot
  if (cached) {
    const cachedCards = cached.taskCards || cards
    const cachedHistory = cached.historyRows || []
    const cachedNomIds = [...new Set([...cachedCards.map(c => c.nomenclature_id), ...cachedHistory.map(h => h.nomenclature_id), ...partIds].filter(Boolean))]
    const missingNomIds = cachedNomIds.filter(id => !nomById.has(str(id)))
    let allNoms = noms
    if (missingNomIds.length) {
      const extra = await must('nomenclatures-extra', supabase.from('nomenclatures').select('id,name,type,units_per_sheet,material_type').in('id', missingNomIds))
      allNoms = [...noms, ...extra]
    }
    console.log(`\nCACHED SNAPSHOT: cards=${cachedCards.length}, history=${cachedHistory.length}, scrapRows=${cachedHistory.filter(h => num(h.scrap_qty) > 0).length}`)
    calculateReportFormula({ label: 'CACHED', snapshot, cards: cachedCards, history: cachedHistory, noms: allNoms })
    summarizeActualCutters('CACHED', cachedHistory)
  } else {
    console.log('\nCACHED SNAPSHOT: none')
  }

  console.log('\nCUTTING HISTORY ROWS FOR REDO CARDS / SUSPICIOUS EXCESS')
  const rowsWithCards = history
    .filter(isCutting)
    .map(h => ({ h, card: cardById.get(str(h.card_id)), nom: nomById.get(str(h.nomenclature_id)) }))
    .filter(x => isRedo(x.card) || num(x.h.qty_completed) !== num(x.card?.quantity))
    .sort((a, b) => str(a.h.completed_at || a.h.created_at).localeCompare(str(b.h.completed_at || b.h.created_at)))

  rowsWithCards.forEach(({ h, card, nom }) => {
    console.log(`  ${h.completed_at || h.created_at || '-'} | ${nom?.name || h.nomenclature_id} | qty_completed=${num(h.qty_completed)} | cardQty=${num(card?.quantity)} | scrap=${num(h.scrap_qty)} | cardStatus=${card?.status || '-'} | redo=${isRedo(card)} | card=${str(h.card_id).slice(0, 8)} | info=${str(card?.card_info).slice(0, 120)}`)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
