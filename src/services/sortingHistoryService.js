const missingRpcError = error => {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  return ['PGRST202', '42883'].includes(code) || (
    message.includes('record_sorting_history_once') && (
      message.includes('not find') ||
      message.includes('does not exist') ||
      message.includes('schema cache')
    )
  )
}

export const recordSortingHistoryGuaranteed = async (client, {
  card,
  operatorName,
  bufferOperatorName,
  shiftName,
  qtyCompleted,
  scrapQty,
  recordedAt
}) => {
  const timestamp = recordedAt || new Date().toISOString()
  const payload = {
    p_card_id: card.id,
    p_nomenclature_id: card.nomenclature_id,
    p_operator_name: operatorName || 'Сортування',
    p_buffer_operator_name: bufferOperatorName || operatorName || 'Сортування',
    p_shift_name: shiftName || 'Без зміни',
    p_qty_at_start: Number(card.quantity) || 0,
    p_qty_completed: Number(qtyCompleted) || 0,
    p_scrap_qty: Number(scrapQty) || 0,
    p_started_at: card.started_at || timestamp,
    p_stage_completed_at: card.completed_at || timestamp,
    p_buffer_completed_at: timestamp,
    p_manager_name: card.manager_name || null,
    p_machine_name: card.machine || null
  }

  const { data, error } = await client.rpc('record_sorting_history_once', payload)
  if (!error) return { data, error: null, source: 'guaranteed-rpc' }

  // Deployment compatibility: old environments keep the established insert
  // behavior until the additive migration is applied. Other RPC errors are
  // never hidden because proceeding would recreate the missing-VKYA bug.
  if (!missingRpcError(error)) return { data: null, error, source: 'rpc-error' }

  const historyRows = [
    {
      card_id: card.id,
      nomenclature_id: card.nomenclature_id,
      stage_name: 'Сортування',
      operator_name: payload.p_buffer_operator_name,
      qty_at_start: payload.p_qty_at_start,
      qty_completed: payload.p_qty_completed,
      scrap_qty: payload.p_scrap_qty,
      started_at: payload.p_started_at,
      completed_at: payload.p_stage_completed_at,
      is_archived_scrap: payload.p_scrap_qty > 0,
      shift_name: payload.p_shift_name,
      manager_name: payload.p_manager_name,
      machine_name: payload.p_machine_name
    },
    {
      card_id: card.id,
      nomenclature_id: card.nomenclature_id,
      stage_name: 'Буфер Сортування',
      operator_name: payload.p_operator_name,
      qty_at_start: payload.p_qty_completed,
      qty_completed: payload.p_qty_completed,
      scrap_qty: 0,
      started_at: payload.p_stage_completed_at,
      completed_at: payload.p_buffer_completed_at,
      is_archived_scrap: false,
      shift_name: payload.p_shift_name,
      manager_name: payload.p_manager_name,
      machine_name: payload.p_machine_name
    }
  ]
  const fallback = await client.from('work_card_history').insert(historyRows)
  return fallback.error
    ? { data: null, error: fallback.error, source: 'compatibility-error' }
    : { data: fallback.data, error: null, source: 'compatibility' }
}
