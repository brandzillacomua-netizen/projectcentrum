const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

const orderNum = '04072026-01'
const num = value => Number(value) || 0
const str = value => String(value || '')

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
    if (info[i] === '}') {
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

function getCutterDiameter(name = '') {
  const lower = String(name || '').toLowerCase().replace(/,/g, '.')
  const direct = lower.match(/ф\s*([0-9]+(?:\.[0-9]+)?)/)
  if (direct) return parseFloat(direct[1])
  const bySize = lower.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9.]*)(?:\s*[×xх])/)
  return bySize ? parseFloat(bySize[1]) : null
}

async function fetchHistory(cardIds) {
  const rows = []
  for (let i = 0; i < cardIds.length; i += 80) {
    const ids = cardIds.slice(i, i + 80)
    rows.push(...await must('work_card_history', supabase
      .from('work_card_history')
      .select('id,card_id,nomenclature_id,stage_name,qty_completed,cutters_used,card_info,completed_at,created_at')
      .in('card_id', ids)
      .limit(10000)
    ))
  }
  return rows
}

function isCutting(row) {
  return str(row.stage_name).trim() === 'Розкрій'
}

function getSheetGroups(task, part) {
  const splits = Array.isArray(part.splits) ? part.splits : []
  if (splits.length > 0) {
    return splits.map(split => ({
      machine: split.machine || part.selected_machine || task.machine_name,
      sheets: num(split.sheets)
    })).filter(group => group.machine && group.sheets > 0)
  }

  return [{
    machine: part.selected_machine || task.machine_name,
    sheets: part.sheets_t300 !== undefined || part.sheets_t700 !== undefined
      ? num(part.sheets_t300) + num(part.sheets_t700)
      : num(part.sheets)
  }].filter(group => group.machine && group.sheets > 0)
}

function findOp(machineOperations, partNomId, machine) {
  return (machineOperations || []).find(op => {
    if (str(op.nomenclature_id) !== str(partNomId)) return false
    return op.machine_type === machine || op.machine_id === machine
  })
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
    .select('id,order_id,step,status,machine_name,plan_snapshot')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
  )
  const task = tasks.find(t => str(t.step).includes('Розкрій'))
  if (!task) throw new Error('Cutting task not found')

  const cards = await must('work_cards', supabase
    .from('work_cards')
    .select('id,task_id,nomenclature_id,status,quantity,actual_sheets,card_info')
    .eq('task_id', task.id)
    .limit(10000)
  )

  const snapshot = task.plan_snapshot || {}
  const partIds = Object.keys(snapshot).filter(key =>
    !key.startsWith('_') &&
    !['materialSummary', 'arrivals', 'arrival_doc_id', 'arrival_doc', 'nomenclatures', 'selectedCutters', 'consumables'].includes(key)
  )

  const history = await fetchHistory(cards.map(card => card.id))
  const cuttingRows = history.filter(isCutting)

  const nomIds = [...new Set([
    ...partIds,
    ...cards.map(card => card.nomenclature_id),
    ...cuttingRows.map(row => row.nomenclature_id)
  ].filter(Boolean))]

  const machineOperations = await must('machine_operations', supabase
    .from('machine_operations')
    .select('id,nomenclature_id,machine_type,machine_id,side2_cut_ops')
    .in('nomenclature_id', partIds)
    .limit(10000)
  )

  const cutterNomIds = new Set()
  machineOperations.forEach(op => {
    ;(op.side2_cut_ops || [])
      .filter(item => str(item).startsWith('__CUTTER__Reference:') || str(item).startsWith('__CUTTER__:'))
      .forEach(item => {
        const [, cutterNomId] = str(item).split(':')
        if (cutterNomId) cutterNomIds.add(cutterNomId)
      })
  })

  const noms = await must('nomenclatures', supabase
    .from('nomenclatures')
    .select('id,name,type,units_per_sheet,material_type')
    .in('id', [...new Set([...nomIds, ...cutterNomIds])])
    .limit(10000)
  )
  const nomById = new Map(noms.map(nom => [str(nom.id), nom]))

  const selectedCutters = snapshot.selectedCutters || {}
  const inventoryIds = [...new Set(Object.values(selectedCutters).filter(Boolean).map(String))]
  const selectedInventory = inventoryIds.length
    ? await must('inventory', supabase.from('inventory').select('id,nomenclature_id,name').in('id', inventoryIds).limit(10000))
    : []
  const invById = new Map(selectedInventory.map(inv => [str(inv.id), inv]))

  const resolveDisplayName = genericName => {
    const selectedInvId = selectedCutters[genericName] || selectedCutters[str(genericName).toLowerCase()]
    const inv = invById.get(str(selectedInvId))
    const selectedNom = inv ? nomById.get(str(inv.nomenclature_id)) : null
    return selectedNom?.name || inv?.name || genericName || 'Фреза'
  }

  const plannedByName = {}
  const actualByName = {}
  const detailRows = []
  let skippedByOverride = 0

  partIds.forEach(partId => {
    const part = snapshot[partId]
    if (!part || typeof part !== 'object') return
    const nom = nomById.get(str(part.id || partId))
    const groups = getSheetGroups(task, part)
    const override = part.cutter_override || '2'
    const partPlan = {}

    groups.forEach(group => {
      const op = findOp(machineOperations, part.id || partId, group.machine)
      const cutterOps = (op?.side2_cut_ops || [])
        .filter(item => str(item).startsWith('__CUTTER__Reference:') || str(item).startsWith('__CUTTER__:'))

      cutterOps.forEach(item => {
        const [, cutterNomId, qtyRaw] = str(item).split(':')
        const qtyPerSheet = parseFloat(qtyRaw) || 0
        const cutterNom = nomById.get(str(cutterNomId))
        let cutterName = cutterNom?.name?.trim() || ''
        if (!cutterName || cutterName.toLowerCase() === 'фреза' || qtyPerSheet <= 0) return

        const diameter = getCutterDiameter(cutterName)
        if (override !== '1.5' && diameter && Math.abs(diameter - 1.5) < 0.01) {
          skippedByOverride += 1
          return
        }
        if (override === '1.5' && diameter && Math.abs(diameter - 2) < 0.01) {
          cutterName = 'Фреза ф1.5'
        }

        const displayName = resolveDisplayName(cutterName)
        const planned = Math.ceil(group.sheets * qtyPerSheet)
        plannedByName[displayName] = (plannedByName[displayName] || 0) + planned
        partPlan[displayName] = (partPlan[displayName] || 0) + planned

        detailRows.push({
          part: nom?.name || partId,
          machine: group.machine,
          sheets: group.sheets,
          opId: op?.id || null,
          rawOp: item,
          cutterName,
          displayName,
          qtyPerSheet,
          planned
        })
      })
    })
  })

  cuttingRows.forEach(row => {
    const parsed = parseCuttersBreakdown(row.card_info)
    if (parsed) {
      Object.entries(parsed).forEach(([name, qty]) => {
        actualByName[name] = (actualByName[name] || 0) + num(qty)
      })
    } else if (num(row.cutters_used) > 0) {
      actualByName['Фреза (без деталізації)'] = (actualByName['Фреза (без деталізації)'] || 0) + num(row.cutters_used)
    }
  })

  console.log(`ORDER ${order.order_num} | task=${task.id} | cards=${cards.length} | cuttingRows=${cuttingRows.length}`)
  console.log(`skippedCutterOpsByOverride=${skippedByOverride}`)
  console.log('\nPLAN DETAIL')
  detailRows
    .sort((a, b) => a.part.localeCompare(b.part) || a.displayName.localeCompare(b.displayName))
    .forEach(row => {
      console.log(`${row.part} | machine=${row.machine} | sheets=${row.sheets} | qtyPerSheet=${row.qtyPerSheet} | planned=${row.planned} | ${row.displayName} | op=${row.rawOp}`)
    })

  console.log('\nPLAN TOTALS')
  Object.entries(plannedByName).forEach(([name, qty]) => console.log(`${name}: ${qty}`))
  console.log(`TOTAL PLAN: ${Object.values(plannedByName).reduce((sum, qty) => sum + qty, 0)}`)

  console.log('\nACTUAL TOTALS')
  Object.entries(actualByName).forEach(([name, qty]) => console.log(`${name}: ${qty}`))
  console.log(`TOTAL ACTUAL: ${Object.values(actualByName).reduce((sum, qty) => sum + qty, 0)}`)

  console.log('\nSNAPSHOT CONSUMABLES')
  ;(snapshot.consumables || []).forEach(item => console.log(`${item.name}: ${item.total}`))
  console.log(`SNAPSHOT CONSUMABLES TOTAL: ${(snapshot.consumables || []).reduce((sum, item) => sum + num(item.total), 0)}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
