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

  const partNom = noms.find(n => n.name.includes('Тест-Деталь В2'))
  console.log('Task:', task?.id)
  console.log('Order:', order?.order_num)
  console.log('PartNom:', partNom?.name, partNom?.id)

  const allOpsForPart = machineOps.filter(o => String(o.nomenclature_id) === String(partNom.id))
  console.log('allOpsForPart count:', allOpsForPart.length)
  console.log('ops machine_types:', allOpsForPart.map(o => o.machine_type))

  const selectedMachineName = 'CNC 12x8'

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

    if (opStr === targetStr) return true
    if (opStr.includes(targetStr) || targetStr.includes(opStr)) return true

    for (const group of machineGroups) {
      const opHasGroup = group.some(kw => opStr.includes(kw))
      const targetHasGroup = group.some(kw => targetStr.includes(kw))
      if (opHasGroup && targetHasGroup) return true
    }
    return false
  }

  const opData = allOpsForPart.find(o =>
    isMachineMatch(o.machine_type, selectedMachineName) ||
    isMachineMatch(o.machine_id, selectedMachineName)
  )

  console.log('Matched opData:', opData ? opData.machine_type : 'NONE!')

  if (opData && opData.side2_cut_ops) {
    console.log('side2_cut_ops:', opData.side2_cut_ops)
    const machineSpecificCutters = {}
    const sheets = 4

    const cutterOps = opData.side2_cut_ops.filter(op => op.startsWith('__CUTTER__Reference:') || op.startsWith('__CUTTER__:'))
    cutterOps.forEach(op => {
      const parts = op.split(':')
      const cutterNomId = parts[1]
      const qtyPerSheet = parseFloat(parts[2]) || 0
      console.log('cutterNomId:', cutterNomId, 'qtyPerSheet:', qtyPerSheet)
      if (cutterNomId && qtyPerSheet > 0) {
        const totalQty = Math.ceil(sheets * qtyPerSheet)
        const cutterNom = noms.find(n => String(n.id) === String(cutterNomId))
        console.log('Found cutterNom:', cutterNom?.name)
        if (cutterNom && cutterNom.name.trim().toLowerCase() !== 'фреза') {
          const cleanName = cutterNom.name.trim()
          const key = cutterNom.id.toString()
          machineSpecificCutters[key] = {
            name: cleanName,
            qty: totalQty,
            nomenclature_id: cutterNom.id
          }
        }
      }
    })

    console.log('machineSpecificCutters:', machineSpecificCutters)

    const requestsToInsert = []
    Object.values(machineSpecificCutters).forEach(item => {
      const consInvItem = inv.find(i => String(i.nomenclature_id) === String(item.nomenclature_id) && i.warehouse === 'operational')
        || inv.find(i => String(i.nomenclature_id) === String(item.nomenclature_id))
      requestsToInsert.push({
        order_id: task.order_id,
        task_id: task.id,
        card_id: null,
        quantity: item.qty,
        status: 'pending',
        inventory_id: consInvItem?.id || null,
        nomenclature_id: item.nomenclature_id,
        details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ДОВИПУСКУ ${order?.order_num || '???'}: ${item.name} — ${item.qty} од. (для ${partNom?.name || '???'})`
      })
    })

    console.log('requestsToInsert to be inserted:', requestsToInsert)
  }
}

main().catch(console.error)
