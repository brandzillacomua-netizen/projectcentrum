import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080'

  // 1) Fetch all nomenclatures to have a cache
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*')
  const { data: machineOperations } = await supabase.from('machine_operations').select('*')

  // 2) Find tasks of this order to get selectedCutters
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId)
  const task = tasks?.find(t => t.plan_snapshot?.selectedCutters)
  const selectedCutters = task?.plan_snapshot?.selectedCutters || {}
  console.log('Selected cutters mapping:', selectedCutters)

  // 3) Find the rework cards
  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('order_id', orderId)
    .eq('is_rework', true)

  console.log(`Found ${cards?.length} rework cards.`)

  const requestsToInsert = []

  for (const card of (cards || [])) {
    const partNom = nomenclatures.find(n => n.id === card.nomenclature_id)
    if (!partNom) continue

    const unitsPerSheet = Number(partNom.units_per_sheet) || 1
    const sheets = Math.ceil(card.quantity / unitsPerSheet)
    console.log(`Card: "${partNom.name}" | Qty: ${card.quantity} | units_per_sheet: ${unitsPerSheet} -> sheets: ${sheets}`)

    const targetMachine = card.machine || ''
    
    // Find machine operations
    let opData = machineOperations?.find(o => 
      String(o.nomenclature_id) === String(partNom.id) &&
      (
        String(o.machine_type).toLowerCase() === String(targetMachine).toLowerCase() || 
        String(o.machine_id).toLowerCase() === String(targetMachine).toLowerCase() ||
        (o.machine_type && String(targetMachine).toLowerCase().includes(String(o.machine_type).toLowerCase())) ||
        (o.machine_id && String(targetMachine).toLowerCase().includes(String(o.machine_id).toLowerCase()))
      )
    )

    if (!opData) {
      opData = machineOperations?.find(o => String(o.nomenclature_id) === String(partNom.id))
    }

    if (opData && opData.side2_cut_ops) {
      const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__.'))
      const machineSpecificCutters = {}
      
      const opsToProcess = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
      opsToProcess.forEach(op => {
        const parts = op.split(':')
        const cutterNomId = parts[1]
        const qtyPerSheet = parseFloat(parts[2]) || 0
        if (cutterNomId && qtyPerSheet > 0) {
          const totalQty = Math.ceil(sheets * qtyPerSheet)
          const cutterNom = nomenclatures.find(n => String(n.id) === String(cutterNomId))
          if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
            const cleanName = cutterNom.name.trim()
            
            // Resolve
            let resolvedCutterNom = cutterNom
            const invId = selectedCutters[cleanName] || selectedCutters[cleanName.toLowerCase()]
            if (invId) {
              const inv = (inventory || []).find(i => String(i.id) === String(invId))
              if (inv) {
                const specNom = nomenclatures.find(n => String(n.id) === String(inv.nomenclature_id))
                if (specNom) resolvedCutterNom = specNom
              }
            }

            const resolvedName = resolvedCutterNom.name.trim()
            const key = resolvedCutterNom.id.toString()
            if (!machineSpecificCutters[key]) {
              machineSpecificCutters[key] = {
                name: resolvedName,
                qty: 0,
                nomenclature_id: resolvedCutterNom.id
              }
            }
            machineSpecificCutters[key].qty += totalQty
          }
        }
      })

      Object.values(machineSpecificCutters).forEach(item => {
        const consInvItem = inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational')
          || inventory.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
        
        requestsToInsert.push({
          order_id: orderId,
          task_id: card.task_id,
          quantity: item.qty,
          status: 'pending',
          inventory_id: consInvItem?.id || null,
          nomenclature_id: item.nomenclature_id,
          details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ 22062026-03: ${item.name} — ${item.qty} од. (для ${partNom.name})`
        })
      })
    }
  }

  // 4) Fetch all current requests to delete the incorrect ones
  const { data: existingRequests } = await supabase
    .from('material_requests')
    .select('*, nomenclatures(name)')
    .eq('order_id', orderId)

  const toDelete = []
  existingRequests?.forEach(r => {
    const name = (r.nomenclatures?.name || '').toLowerCase()
    
    // Check if it's an operation or generic cutter
    const isOperation = name.includes('уп1') || name.includes('уп2') || name.includes('операція')
    const isGenericCutter = name === 'фреза ф2' || name === 'фреза ф3' || name === 'фреза ф4' || name === 'фреза ф6' || name === 'фреза ф6 (90)' || name === 'фреза ф6 (120)' || name === 'фреза ф3.175 (90)'
    
    if (isOperation || isGenericCutter) {
      toDelete.push(r.id)
      console.log(`Plan to DELETE: "${r.nomenclatures?.name}" (ID: ${r.id})`)
    } else {
      console.log(`Plan to KEEP: "${r.nomenclatures?.name}" (ID: ${r.id})`)
    }
  })

  // 5) Perform deletions and insertions
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from('material_requests').delete().in('id', toDelete)
    if (delErr) console.error('Delete error:', delErr)
    else console.log(`Successfully deleted ${toDelete.length} incorrect requests.`)
  }

  if (requestsToInsert.length > 0) {
    // Check for duplicates in requestsToInsert (e.g. if same cutter requested twice, merge)
    const mergedRequests = []
    requestsToInsert.forEach(req => {
      const existing = mergedRequests.find(mr => mr.nomenclature_id === req.nomenclature_id)
      if (existing) {
        existing.quantity += req.quantity
        existing.details = existing.details.replace(/— \d+ од/, `— ${existing.quantity} од`)
      } else {
        mergedRequests.push(req)
      }
    })

    console.log('Inserting correct requests:', mergedRequests)
    const { error: insErr } = await supabase.from('material_requests').insert(mergedRequests)
    if (insErr) console.error('Insert error:', insErr)
    else console.log(`Successfully inserted ${mergedRequests.length} correct requests.`)
  }
}

main().catch(console.error)
