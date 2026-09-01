const chunk = (rows, size) => {
  const chunks = []
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size))
  return chunks
}

export async function fetchFinalScrapTotals(supabase, taskIds = []) {
  const uniqueTaskIds = [...new Set(taskIds.filter(Boolean).map(String))]
  if (uniqueTaskIds.length === 0) return []

  const rows = []
  for (const taskChunk of chunk(uniqueTaskIds, 40)) {
    const { data, error } = await supabase
      .from('vkya_final_scrap_totals')
      .select('*')
      .in('task_id', taskChunk)
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

export async function fetchVkyaReturnedTotals(supabase, taskIds = []) {
  const uniqueTaskIds = [...new Set(taskIds.filter(Boolean).map(String))]
  if (uniqueTaskIds.length === 0) return []

  const rows = []
  for (const taskChunk of chunk(uniqueTaskIds, 40)) {
    const { data, error } = await supabase
      .from('vkya_quality_resolutions')
      .select('*')
      .in('task_id', taskChunk)
      .eq('disposition', 'returned_to_route')
    if (error) throw error
    rows.push(...(data || []))
  }
  return rows
}

export async function returnQualityHoldToRoute(supabase, {
  sourceHistoryId,
  quantity,
  userId = null,
  userName = null,
  notes = null
}) {
  const { data, error } = await supabase.rpc('return_vkya_quantity_to_route', {
    p_source_history_id: sourceHistoryId,
    p_quantity: Number(quantity),
    p_resolved_by_user_id: userId,
    p_resolved_by_name: userName,
    p_notes: notes
  })
  if (error) throw error
  return data
}

export async function createRestorationFromQualityHold(supabase, {
  sourceHistoryId,
  quantity,
  restorationStageId,
  userId = null,
  userName = null
}) {
  const { data, error } = await supabase.rpc('create_vkya_restoration_from_hold', {
    p_source_history_id: sourceHistoryId,
    p_quantity: Number(quantity),
    p_restoration_stage_id: restorationStageId,
    p_created_by_user_id: userId,
    p_created_by_name: userName
  })
  if (error) throw error
  return data
}

export async function returnRestorationToRoute(supabase, {
  restorationCardId,
  userName = null
}) {
  const { data, error } = await supabase.rpc('return_vkya_restoration_to_route', {
    p_restoration_card_id: restorationCardId,
    p_returned_by: userName
  })
  if (error) throw error
  return data
}

export async function fetchRecoverableScrapLots(supabase) {
  const { data, error } = await supabase
    .from('vkya_recoverable_scrap_lots')
    .select('*')
    .gt('available_quantity', 0)
    .order('classified_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function createReworkFromScrapLot(supabase, {
  classificationCategoryId,
  quantity,
  userId = null,
  userName = null
}) {
  const { data, error } = await supabase.rpc('create_vkya_rework_from_lot', {
    p_classification_category_id: classificationCategoryId,
    p_quantity: Number(quantity),
    p_created_by_user_id: userId,
    p_created_by_name: userName
  })
  if (error) throw error
  return data
}

export async function createRestorationFromScrapLot(supabase, {
  classificationCategoryId,
  quantity,
  restorationStageId,
  userId = null,
  userName = null
}) {
  const { data, error } = await supabase.rpc('create_vkya_restoration_from_lot', {
    p_classification_category_id: classificationCategoryId,
    p_quantity: Number(quantity),
    p_restoration_stage_id: restorationStageId,
    p_created_by_user_id: userId,
    p_created_by_name: userName
  })
  if (error) throw error
  return data
}
