import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const normalize = (s) => (s || '').toLowerCase().trim()
  .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
  .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
  .replace(/[хx]/g, 'x').replace(/[іi]/g, 'i').replace(/[уy]/g, 'y')
  .replace(/[кk]/g, 'k').replace(/[мm]/g, 'm').replace(/[нn]/g, 'n')
  .replace(/[вv]/g, 'v').replace(/[и]/g, 'y').replace(/\s/g, '')

async function run() {
  const parentId = 'af2ab774-42e0-4617-9c2e-fe1e3c61d6a2' // Рама KHARAK 10`(210)
  const orderId = 'bb021c64-6bcf-4191-9477-a42b29101bc7' // Order 2222
  const taskId = 'c54c9af2-bcc6-4fc7-8e61-9b287e30f53a' // Task c54c9af2-bcc6-4fc7-8e61-9b287e30f53a
  
  const latinIdsToDelete = [
    'd6555dfc-9795-4db0-a3a2-350a4c11c8ba', // KR-210-415-B-3-28 (Latin B)
    '84e40f79-01e4-46c7-8651-39c9fb77ced4', // KR-10(210)-H-3-18 (Latin H)
    '43f406fa-faa3-4a17-994f-cfeaddc701d0'  // KH-10(210)-X-4-109 (Latin X)
  ]
  
  console.log('=== Step 1: Deleting duplicate Latin BOM items from Database ===')
  const { data: delBoms, error: delErr } = await supabase
    .from('bom_items')
    .delete()
    .eq('parent_id', parentId)
    .in('child_id', latinIdsToDelete)
    .select()
    
  if (delErr) {
    console.error('Error deleting Latin BOMs:', delErr)
    return
  }
  console.log(`Deleted ${delBoms?.length || 0} BOM items.`)
  delBoms?.forEach(d => console.log(`- Deleted BOM ID: ${d.id}, Child: ${d.child_id}`))

  console.log('\n=== Step 2: Fetching fresh data to rebuild task plan_snapshot ===')
  const { data: order } = await supabase.from('orders').select('*, order_items(*)').eq('id', orderId).single()
  const { data: bomItems } = await supabase.from('bom_items').select('*')
  const { data: nomenclatures } = await supabase.from('nomenclatures').select('*')
  const { data: inventory } = await supabase.from('inventory').select('*')
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single()

  console.log(`Order: #${order.order_num}, Task planned_sets: ${task.planned_sets}`)

  let totalMin = 0
  const materialSummary = {}
  const plan_snapshot = {}
  
  order.order_items?.forEach(item => {
    const requestedQty = Number(task.planned_sets)
    if (requestedQty <= 0) return
    
    const parts = bomItems.filter(b => String(b.parent_id) === String(item.nomenclature_id))
    const displayParts = parts.length > 0 ? parts.map(b => ({ 
      nom: nomenclatures.find(n => String(n.id) === String(b.child_id)), 
      qtyPer: b.quantity_per_parent 
    })) : [{ 
      nom: nomenclatures.find(n => String(n.id) === String(item.nomenclature_id)), 
      qtyPer: 1 
    }]
    
    displayParts.forEach(part => {
      if (!part.nom) return
      const totalNeeded = requestedQty * (Number(part.qtyPer) || 1)
      const invItem = inventory.find(i => String(i.nomenclature_id) === String(part.nom.id) && i.type === 'bz')
      const inStockQty = invItem ? Math.max(0, (Number(invItem.total_qty) || 0) - (Number(invItem.reserved_qty) || 0)) : 0
      const totalToProduce = Math.max(0, totalNeeded - inStockQty)
      const unitsPerSheet = Number(part.nom.units_per_sheet) || 1
      let sheets = Math.ceil(totalToProduce / unitsPerSheet)
      
      plan_snapshot[part.nom.id] = { 
        id: part.nom.id, 
        name: part.nom.name, 
        code: part.nom.nomenclature_code, 
        need: totalNeeded, 
        stock: inStockQty, 
        plan: totalToProduce, 
        units_per_sheet: unitsPerSheet, 
        sheets: sheets, 
        material: part.nom.material_type, 
        order_item_id: item.id 
      }
      
      if (totalToProduce <= 0) return
      
      const matKeyBase = (part.nom.material_type || part.nom.name || 'Інше').trim()
      const matKey = normalize(matKeyBase)
      const rawNom = nomenclatures.find(n => (n.type === 'raw' || n.type === 'material') && (normalize(n.name) === matKey || normalize(n.material_type) === matKey))
      const matId = rawNom?.id || (part.nom.type === 'raw' ? part.nom.id : 'unknown-' + matKey)
      
      if (!materialSummary[matId]) {
        const unit = (part.nom.type === 'hardware' || part.nom.type === 'fastener') ? 'шт' : 'ЛИСТІВ'
        materialSummary[matId] = { 
          matName: rawNom?.name || matKeyBase, 
          sheets: 0, 
          totalUnits: 0, 
          components: [], 
          inventory_id: null, 
          nomenclature_id: rawNom?.id || (part.nom.type === 'raw' ? part.nom.id : null), 
          unit, 
          partType: rawNom?.type || (part.nom.type === 'raw' ? 'raw' : 'unknown') 
        }
        if (materialSummary[matId].nomenclature_id) {
          const inv = inventory.find(i => String(i.nomenclature_id) === String(materialSummary[matId].nomenclature_id))
          materialSummary[matId].inventory_id = inv?.id || null
        }
      }
      materialSummary[matId].sheets += sheets
      materialSummary[matId].totalUnits += totalToProduce
      materialSummary[matId].components.push(`${part.nom.name}: ${totalToProduce}шт`)
      totalMin += totalToProduce * (Number(part.nom.time_per_unit) || 0)
    })
  })
  
  plan_snapshot._metadata = { 
    planned_deadline: task.planned_deadline || order.deadline, 
    batch_index: task.batch_index 
  }
  plan_snapshot.materialSummary = materialSummary
  
  console.log('\nGenerated New plan_snapshot Keys:', Object.keys(plan_snapshot).filter(k => k !== 'materialSummary' && k !== '_metadata'))
  console.log('New materialSummary:', JSON.stringify(materialSummary, null, 2))

  console.log('\n=== Step 3: Updating task row in database ===')
  const { data: updatedTask, error: taskUpdErr } = await supabase
    .from('tasks')
    .update({ 
      plan_snapshot: plan_snapshot,
      estimated_time: Math.round(totalMin)
    })
    .eq('id', taskId)
    .select()
    
  if (taskUpdErr) {
    console.error('Error updating task in database:', taskUpdErr)
    return
  }
  console.log('Task successfully updated.')

  console.log('\n=== Step 4: Recreating material_requests in database ===')
  // Delete old requests
  const { error: delReqsErr } = await supabase
    .from('material_requests')
    .delete()
    .eq('task_id', taskId)
    
  if (delReqsErr) {
    console.error('Error deleting old material requests:', delReqsErr)
    return
  }
  console.log('Deleted old material requests.')

  // Re-create new requests
  const allMaterials = Object.values(materialSummary).map(info => ({ ...info, sheets: Number(info.sheets) || 0 }))
  const requestsToInsert = allMaterials
    .filter(info => info.partType === 'raw' || (info.matName && (normalize(info.matName).includes(normalize('лист')) || normalize(info.matName).includes(normalize('фреза')))))
    .map(info => {
      const qtyToRequest = info.unit === 'ЛИСТІВ' ? info.sheets : info.totalUnits;
      const unitLabel = info.unit === 'ЛИСТІВ' ? 'л.' : 'од.';
      return { 
        order_id: orderId, 
        task_id: taskId, 
        quantity: qtyToRequest, 
        status: 'pending', 
        inventory_id: info.inventory_id, 
        nomenclature_id: info.nomenclature_id, 
        details: `СКЛАД ОПЕРАТИВНИЙ: ${info.matName} — ${qtyToRequest} ${unitLabel} (Разом: ${info.totalUnits} шт | Для: ${info.components.join(', ')})` 
      }
    })
    
  const totalActualSheets = allMaterials.filter(m => m.unit === 'ЛИСТІВ').reduce((acc, m) => acc + (m.sheets || 0), 0)
  if (totalActualSheets > 0) {
    nomenclatures
      .filter(n => n.type === 'consumable' && (Number(n.consumption_per_sheet) || 0) > 0 && (n.name.toLowerCase().includes('лист') || n.name.toLowerCase().includes('фреза')))
      .forEach(cons => {
        const neededQty = Math.ceil(totalActualSheets * Number(cons.consumption_per_sheet))
        const invItem = inventory.find(i => i.nomenclature_id === cons.id)
        requestsToInsert.push({ 
          order_id: orderId, 
          task_id: taskId, 
          quantity: neededQty, 
          status: 'pending', 
          inventory_id: invItem?.id || null, 
          nomenclature_id: cons.id, 
          details: `ВИТРАТНІ МАТЕРІАЛИ ДЛЯ ${order.order_num}: ${cons.name} — ${neededQty} од.` 
        })
      })
  }

  if (requestsToInsert.length > 0) {
    console.log('Inserting new material requests:')
    requestsToInsert.forEach(r => console.log(`- Qty: ${r.quantity}, Details: ${r.details}`))
    const { data: insReqs, error: insErr } = await supabase
      .from('material_requests')
      .insert(requestsToInsert)
      .select()
      
    if (insErr) {
      console.error('Error inserting material requests:', insErr)
      return
    }
    console.log(`Inserted ${insReqs?.length || 0} material requests successfully.`)
  } else {
    console.log('No material requests to insert.')
  }
  
  console.log('\n=== FIX COMPLETED SUCCESSFULLY ===')
}

run()
