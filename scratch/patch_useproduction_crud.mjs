import { readFileSync, writeFileSync } from 'fs'

const filePath = 'a:/centrum/src/contexts/useProduction.js'
let src = readFileSync(filePath, 'utf8')
const hasCRLF = src.includes('\r\n')
if (hasCRLF) src = src.replace(/\r\n/g, '\n')

// ── PATCH 1: Add updateOrder and deleteOrder to useProduction.js ─────────────
const addOrderAnchor = `  const addOrder = async (header, items) => {`

const orderCrudFunctions = `  const updateOrder = async (orderId, header, items) => {
    if (header.customer) {
      const trimmedName = header.customer.trim()
      const { data: existing } = await supabase.from('customers').select('id').ilike('name', trimmedName).maybeSingle()
      if (!existing) await supabase.from('customers').insert([{ name: trimmedName, official_name: header.official_customer?.trim() || '' }])
    }

    let supaNomenclatureId = null;
    if (header.productName) {
      const { data: nomRow } = await supabase.from('nomenclatures').select('id').ilike('name', header.productName.trim()).maybeSingle();
      if (nomRow) {
        supaNomenclatureId = nomRow.id;
      } else {
        const normInput = normalizeName(header.productName);
        const match = (nomenclatures || []).find(n => normalizeName(n.name) === normInput);
        if (match) supaNomenclatureId = match.id;
      }
    }

    const orderedQty = items?.[0]?.quantity || header.quantity || 0;
    
    // Update order header
    const { error } = await supabase.from('orders').update({
      customer: header.customer,
      official_customer: header.official_customer,
      deadline: header.deadline,
      nomenclature_id: supaNomenclatureId,
      quantity: Number(orderedQty),
      accessories: header.productName || '',
    }).eq('id', orderId)
    
    if (error) throw error

    // Re-sync order_items
    if (supaNomenclatureId) {
      await supabase.from('order_items').delete().eq('order_id', orderId)
      await supabase.from('order_items').insert([{
        order_id: orderId,
        nomenclature_id: supaNomenclatureId,
        quantity: Number(orderedQty)
      }])
    }

    refreshTable('orders')
  }

  const deleteOrder = async (orderId) => {
    // Delete linked order items first
    await supabase.from('order_items').delete().eq('order_id', orderId)
    
    // Delete linked tasks and tasks' material requests
    const { data: tasks } = await supabase.from('tasks').select('id').eq('order_id', orderId)
    if (tasks && tasks.length > 0) {
      const taskIds = tasks.map(t => t.id)
      await supabase.from('material_requests').delete().in('task_id', taskIds)
      await supabase.from('work_cards').delete().in('task_id', taskIds)
      await supabase.from('tasks').delete().in('id', taskIds)
    }
    
    // Delete the order itself
    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) throw error
    
    refreshTable('orders')
  }

  const addOrder = async (header, items) => {`

if (!src.includes(addOrderAnchor)) { console.error('addOrder anchor not found'); process.exit(1) }
src = src.replace(addOrderAnchor, orderCrudFunctions)
console.log('✓ CRUD functions injected in useProduction.js')

// ── PATCH 2: Expose updateOrder and deleteOrder in returned object ───────────
const returnAnchor = `    addOrder, createWorkCard, createWorkCardsBatch, startWorkCard, completeWorkCard, confirmBuffer,`
const returnNew = `    addOrder, updateOrder, deleteOrder, createWorkCard, createWorkCardsBatch, startWorkCard, completeWorkCard, confirmBuffer,`

if (!src.includes(returnAnchor)) { console.error('return anchor not found'); process.exit(1) }
src = src.replace(returnAnchor, returnNew)
console.log('✓ Returned methods exposed')

if (hasCRLF) src = src.replace(/\n/g, '\r\n')
writeFileSync(filePath, src, 'utf8')
console.log('✓ useProduction.js saved successfully')
