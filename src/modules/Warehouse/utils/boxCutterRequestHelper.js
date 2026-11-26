/**
 * Persists a per-card cutter request during box preparation without
 * double-reserving cutters that are already reserved at the task level
 * (e.g. `ДЛЯ ДОВИПУСКУ` requests with `card_id = null`).
 */
export async function syncPreparedBoxCutterRequest({
  supabase,
  card,
  cutter,
  qtyToDeduct,
  includeCategory = false
}) {
  const { data: existingReq, error: existingReqError } = await supabase
    .from('material_requests')
    .select('*')
    .eq('card_id', card.id)
    .eq('nomenclature_id', cutter.nomenclature_id)
    .maybeSingle()
  if (existingReqError) throw existingReqError

  if (existingReq) {
    const { error: updateErr } = await supabase
      .from('material_requests')
      .update({ quantity: qtyToDeduct, status: 'issued' })
      .eq('id', existingReq.id)
    if (updateErr) throw updateErr
    return { mode: 'updated_card_request', id: existingReq.id }
  }

  // Check if an unlinked task-level issued reservation already covers this cutter
  if (card.task_id && cutter.nomenclature_id) {
    const { data: taskIssuedReqs, error: taskReqError } = await supabase
      .from('material_requests')
      .select('*')
      .eq('task_id', card.task_id)
      .is('card_id', null)
      .eq('nomenclature_id', cutter.nomenclature_id)
      .eq('status', 'issued')
      .gt('quantity', 0)
      .order('created_at', { ascending: true })
    if (taskReqError) throw taskReqError

    let remainingToSplit = Number(qtyToDeduct) || 0
    for (const taskReq of taskIssuedReqs || []) {
      if (remainingToSplit <= 0) break
      const available = Number(taskReq.quantity) || 0
      if (available <= 0) continue

      const take = Math.min(available, remainingToSplit)
      const nextQty = Math.max(0, available - take)
      const { error: splitErr } = await supabase
        .from('material_requests')
        .update({
          quantity: nextQty,
          status: nextQty === 0 ? 'completed' : 'issued',
          updated_at: new Date().toISOString()
        })
        .eq('id', taskReq.id)
      if (splitErr) throw splitErr

      remainingToSplit -= take
    }
  }

  const cardLabel = card.card_info?.split(' ')[0] || `№${String(card.id || '').substring(0, 8)}`
  const insertPayload = {
    order_id: card.order_id,
    task_id: card.task_id,
    card_id: card.id,
    nomenclature_id: cutter.nomenclature_id,
    inventory_id: cutter.inventory_id || null,
    quantity: qtyToDeduct,
    status: 'issued',
    details: `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}) (ОБРАНО ВРУЧНУ): ${cutter.name} — ${qtyToDeduct} шт.`
  }
  if (includeCategory) {
    insertPayload.category = 'cutter'
    insertPayload.target_warehouse = 'operational'
  }

  const { error: insertErr } = await supabase
    .from('material_requests')
    .insert(insertPayload)
  if (insertErr) throw insertErr

  return { mode: 'inserted_card_request' }
}
