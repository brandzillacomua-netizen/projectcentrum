const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'
const str = value => String(value || '')
const num = value => Number(value) || 0

async function must(label, query) {
  const { data, error } = await query
  if (error) throw new Error(`${label}: ${error.message}`)
  return data || []
}

function parseCuttersBreakdown(cardInfo = '') {
  const info = String(cardInfo || '')
  const markerIdx = info.indexOf('[CUTTERS_BREAKDOWN:')
  if (markerIdx === -1) return null
  const jsonStart = info.indexOf('{', markerIdx)
  if (jsonStart === -1) return null

  let depth = 0
  let jsonEnd = -1
  for (let i = jsonStart; i < info.length; i += 1) {
    if (info[i] === '{') depth += 1
    else if (info[i] === '}') {
      depth -= 1
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

async function fetchHistory(cardIds) {
  const rows = []
  for (let i = 0; i < cardIds.length; i += 80) {
    const ids = cardIds.slice(i, i + 80)
    rows.push(...await must('work_card_history', supabase
      .from('work_card_history')
      .select('id,card_id,nomenclature_id,stage_name,operator_name,qty_completed,scrap_qty,cutters_used,card_info,completed_at,created_at')
      .in('card_id', ids)
      .limit(10000)
    ))
  }
  return rows
}

function isCutting(row) {
  return str(row.stage_name).trim() === 'Розкрій'
}

function cardSeq(cardInfo = '') {
  const match = str(cardInfo).match(/(?:\[REDO\]\s*)?(\d+)\s*\/\s*(\d+)/)
  return match ? `${match[1]}/${match[2]}` : '-'
}

async function main() {
  const [order] = await must('orders', supabase
    .from('orders')
    .select('id,order_num')
    .eq('order_num', orderNum)
    .limit(1)
  )
  if (!order) throw new Error(`Order ${orderNum} not found`)

  const tasks = await must('tasks', supabase
    .from('tasks')
    .select('id,step')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  )
  const task = tasks.find(t => str(t.step).includes('Розкрій'))
  if (!task) throw new Error('Cutting task not found')

  const cards = await must('work_cards', supabase
    .from('work_cards')
    .select('id,nomenclature_id,quantity,status,card_info')
    .eq('task_id', task.id)
    .limit(10000)
  )
  const cardsById = new Map(cards.map(card => [str(card.id), card]))

  const history = await fetchHistory(cards.map(card => card.id))
  const cuttingRows = history.filter(isCutting)

  const nomIds = [...new Set([
    ...cards.map(card => card.nomenclature_id),
    ...cuttingRows.map(row => row.nomenclature_id)
  ].filter(Boolean))]
  const noms = await must('nomenclatures', supabase
    .from('nomenclatures')
    .select('id,name')
    .in('id', nomIds)
    .limit(10000)
  )
  const nomById = new Map(noms.map(nom => [str(nom.id), nom]))

  const rowsWithBreakdown = []
  const allZeroRows = []
  const noBreakdownRows = []

  cuttingRows.forEach(row => {
    const card = cardsById.get(str(row.card_id))
    const parsed = parseCuttersBreakdown(row.card_info)
    if (!parsed || Object.keys(parsed).length === 0) {
      if (num(row.cutters_used) <= 0) noBreakdownRows.push({ row, card })
      return
    }

    rowsWithBreakdown.push({ row, card, parsed })
    const values = Object.values(parsed).map(num)
    if (values.length > 0 && values.every(value => value === 0)) {
      allZeroRows.push({ row, card, parsed })
    }
  })

  console.log(`ORDER ${order.order_num} | task=${task.id}`)
  console.log(`cuttingRows=${cuttingRows.length}`)
  console.log(`withBreakdown=${rowsWithBreakdown.length}`)
  console.log(`allCuttersZeroRows=${allZeroRows.length}`)
  console.log(`noBreakdownAndZeroCuttersUsedRows=${noBreakdownRows.length}`)

  if (allZeroRows.length > 0) {
    console.log('\nALL CUTTERS ZERO')
    allZeroRows.forEach(({ row, card, parsed }) => {
      const nom = nomById.get(str(row.nomenclature_id))
      console.log([
        `card=${str(row.card_id).slice(0, 8)}`,
        `seq=${cardSeq(card?.card_info || row.card_info)}`,
        `detail=${nom?.name || row.nomenclature_id}`,
        `operator=${row.operator_name || '-'}`,
        `qtyCompleted=${num(row.qty_completed)}`,
        `scrap=${num(row.scrap_qty)}`,
        `date=${row.completed_at || row.created_at || '-'}`,
        `breakdown=${JSON.stringify(parsed)}`
      ].join(' | '))
    })
  }

  if (noBreakdownRows.length > 0) {
    console.log('\nNO BREAKDOWN + cutters_used=0')
    noBreakdownRows.forEach(({ row, card }) => {
      const nom = nomById.get(str(row.nomenclature_id))
      console.log([
        `card=${str(row.card_id).slice(0, 8)}`,
        `seq=${cardSeq(card?.card_info || row.card_info)}`,
        `detail=${nom?.name || row.nomenclature_id}`,
        `operator=${row.operator_name || '-'}`,
        `qtyCompleted=${num(row.qty_completed)}`,
        `scrap=${num(row.scrap_qty)}`,
        `date=${row.completed_at || row.created_at || '-'}`
      ].join(' | '))
    })
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
