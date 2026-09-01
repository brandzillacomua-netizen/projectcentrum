import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const taskId = '99190e0a-91b0-4a44-ab5e-b1a1ec393ffe'
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  const { data: order } = await supabase.from('orders').select('*').eq('id', task.order_id).single()
  const { data: noms } = await supabase.from('nomenclatures').select('*')
  const { data: machineOps } = await supabase.from('machine_operations').select('*')
  const { data: inv } = await supabase.from('inventory').select('*')

  const partNom = noms.find(n => n.name.includes('Тест-Деталь В1'))

  // Create test work card
  const { data: card, error: cardErr } = await supabase
    .from('work_cards')
    .insert({
      task_id: task.id,
      order_id: task.order_id,
      nomenclature_id: partNom.id,
      operation: 'Розкрій',
      machine: 'CNC 12x8',
      quantity: 40,
      estimated_time: 1200,
      status: 'waiting-cutters',
      is_rework: false,
      card_info: '№1 [NEED:50] [REQ:40] [BZ:0]'
    })
    .select()
    .single()

  console.log('Created work_card:', card)

  // Now create material requests using exact logic
  const allOpsForPart = machineOps.filter(o => String(o.nomenclature_id) === String(partNom.id))
  
  const machineGroups = [
    ['1200', '12x8', '12х8', 'мал'],
    ['3050', '16x16', '16х16'],
    ['3060', '30x16', '30х16', 'три головий'],
    ['6000', '60x20', '60х20', 'дракон'],
    ['ke xin', 'kexin', 'фея']
  ]

  function isMachineMatch(opMachine, targetMachine) {
    if (!opMachine || !targetMachine) return false
    const opStr = String(opMachine).toLowerCase().trim()
    const targetStr = String(targetMachine).toLowerCase().trim()
    if (opStr === targetStr || opStr.includes(targetStr) || targetStr.includes(opStr)) return true
    for (const group of machineGroups) {
      if (group.some(kw => opStr.includes(kw)) && group.some(kw => targetStr.includes(kw))) return true
    }
    return false
  }

  const opData = allOpsForPart.find(o => isMachineMatch(o.machine_type, 'CNC 12x8') || isMachineMatch(o.machine_id, 'CNC 12x8'))

  console.log('Matched opData:', opData?.machine_type)

  const machineSpecificCutters = {}
  const sheets = 4

  if (opData && opData.side2_cut_ops) {
    const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
    cutterOps.forEach(op => {
      const parts = op.split(':')
      const cutterNomId = parts[1]
      const qtyPerSheet = parseFloat(parts[2]) || 0
      if (cutterNomId && qtyPerSheet > 0) {
        const totalQty = Math.ceil(sheets * qtyPerSheet)
        const cutterNom = noms.find(n => String(n.id) === String(cutterNomId))
        if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
          machineSpecificCutters[cutterNom.id] = {
            name: cutterNom.name.trim(),
            qty: totalQty,
            nomenclature_id: cutterNom.id
          }
        }
      }
    })
  }

  const requestsToInsert = []
  Object.values(machineSpecificCutters).forEach(item => {
    const consInvItem = inv.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational')
      || inv.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
    requestsToInsert.push({
      order_id: task.order_id,
      task_id: task.id,
      card_id: card.id,
      quantity: item.qty,
      status: 'pending',
      inventory_id: consInvItem?.id || null,
      nomenclature_id: item.nomenclature_id,
      details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ ${order?.order_num || '???'}: ${item.name} — ${item.qty} од. (для ${partNom?.name || '???'})`
    })
  })

  console.log('Inserting material_requests:', requestsToInsert)
  const { data: insertedReqs, error: insertErr } = await supabase.from('material_requests').insert(requestsToInsert).select()

  if (insertErr) console.error('Error inserting:', insertErr)
  else console.log('✅ Successfully inserted material_requests:', insertedReqs)
}

main().catch(console.error)
