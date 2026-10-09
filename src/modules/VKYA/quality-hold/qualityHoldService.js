import { isTestEnvironment } from '../../../supabase.js'
import { getLegacyCategoryOneQuantity, getPendingRecoverableQty } from './qualityHoldModel.js'

const chunk = (rows, size) => {
  const chunks = []
  for (let index = 0; index < rows.length; index += size) chunks.push(rows.slice(index, index + size))
  return chunks
}

const isMissingRelation = (error) => (
  error?.code === 'PGRST205' ||
  error?.code === '42P01' ||
  error?.status === 404 ||
  String(error?.message || '').includes('schema cache') ||
  String(error?.message || '').includes('does not exist') ||
  String(error?.message || '').includes('Not Found')
)

const fetchAllPages = async (makeQuery, pageSize = 1000) => {
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makeQuery(from, from + pageSize - 1)
    if (error) {
      if (isMissingRelation(error)) return []
      throw error
    }
    rows.push(...(data || []))
    if (!data || data.length < pageSize) break
  }
  return rows
}

export async function fetchFinalScrapTotals(supabase, taskIds = []) {
  if (isTestEnvironment()) return []
  const uniqueTaskIds = [...new Set(taskIds.filter(Boolean).map(String))]
  if (uniqueTaskIds.length === 0) return []

  const rows = []
  for (const taskChunk of chunk(uniqueTaskIds, 40)) {
    const { data, error } = await supabase
      .from('vkya_final_scrap_totals')
      .select('*')
      .in('task_id', taskChunk)
    const isMissingTable = (err) => (
      err?.code === 'PGRST205' ||
      err?.status === 404 ||
      String(err?.message || '').includes('schema cache') ||
      String(err?.message || '').includes('Not Found')
    )
    if (error) {
      if (isMissingTable(error)) return []
      throw error
    }
    rows.push(...(data || []))
  }
  return rows
}

export async function fetchVkyaReturnedTotals(supabase, taskIds = []) {
  if (isTestEnvironment()) return []
  const uniqueTaskIds = [...new Set(taskIds.filter(Boolean).map(String))]
  if (uniqueTaskIds.length === 0) return []

  const isMissingTable = (err) => (
    err?.code === 'PGRST205' ||
    err?.status === 404 ||
    String(err?.message || '').includes('schema cache') ||
    String(err?.message || '').includes('Not Found')
  )

  const rows = []
  for (const taskChunk of chunk(uniqueTaskIds, 40)) {
    const { data, error } = await supabase
      .from('vkya_quality_resolutions')
      .select('*')
      .in('task_id', taskChunk)
      .eq('disposition', 'returned_to_route')
    if (error) {
      if (isMissingTable(error)) return []
      throw error
    }
    rows.push(...(data || []))
  }
  return rows
}

export async function fetchCurrentVkyaItems(supabase, taskIds = [], orderIds = []) {
  if (isTestEnvironment()) return []
  const uniqueTaskIds = [...new Set(taskIds.filter(Boolean).map(String))]
  const uniqueOrderIds = [...new Set(orderIds.filter(Boolean).map(String))]
  if (uniqueTaskIds.length === 0 && uniqueOrderIds.length === 0) return []
  const taskSet = new Set(uniqueTaskIds)
  const orderSet = new Set(uniqueOrderIds)
  const getScopeMatch = (taskId, orderId) => {
    if (taskId && taskSet.has(String(taskId))) return 'task'
    if (orderId && orderSet.has(String(orderId))) return 'order'
    return null
  }

  const quarantineRows = await fetchAllPages((from, to) => supabase
    .from('vkya_classification_queue_projection')
    .select('source_type, source_id, payload, is_active')
    .eq('is_active', true)
    .range(from, to))

  const scopedQuarantineRows = quarantineRows.filter(row => {
    const payload = row?.payload || {}
    return Boolean(getScopeMatch(
      payload.task_id || payload.source_task_id,
      payload.order_id || payload.source_order_id
    ))
  })
  const quarantineScopeByHistoryId = new Map(scopedQuarantineRows
    .filter(row => row.source_type === 'history' && row.source_id)
    .map(row => {
      const payload = row.payload || {}
      const taskId = payload.task_id || payload.source_task_id || null
      const orderId = payload.order_id || payload.source_order_id || null
      return [String(row.source_id), {
        taskId,
        orderId,
        nomenclatureId: payload.nomenclature_id || null,
        scopeMatch: getScopeMatch(taskId, orderId)
      }]
    }))

  const classificationsById = new Map()
  const restorationRowsById = new Map()
  const restorationConsumedByHistory = new Map()
  const recoverableLotsByCategoryId = new Map()

  // This is the same source-aware category-1 ledger used by the VKYA module.
  // It retains the classified part of a hold after the queue projection has
  // shrunk to only the unclassified remainder (e.g. 98 classified + 2 held).
  for (const taskChunk of chunk(uniqueTaskIds, 40)) {
    const { data, error } = await supabase
      .from('vkya_recoverable_scrap_lots')
      .select('*')
      .in('task_id', taskChunk)
    if (error && !isMissingRelation(error)) throw error
    ;(data || []).forEach(row => recoverableLotsByCategoryId.set(String(row.classification_category_id), row))
  }
  for (const orderChunk of chunk(uniqueOrderIds, 40)) {
    const { data, error } = await supabase
      .from('vkya_recoverable_scrap_lots')
      .select('*')
      .in('order_id', orderChunk)
    if (error && !isMissingRelation(error)) throw error
    ;(data || []).forEach(row => recoverableLotsByCategoryId.set(String(row.classification_category_id), row))
  }

  // The classification row can have an incomplete task/order link, while its
  // source_history_id always points back to the exact quarantine event. Follow
  // that relation first so classified category-1 quantities stay in the same
  // order scope as their original quality hold.
  const scopedHistoryIds = scopedQuarantineRows
    .filter(row => row.source_type === 'history' && row.source_id)
    .map(row => String(row.source_id))
  for (const historyChunk of chunk(scopedHistoryIds, 100)) {
    const [classificationResult, restorationResult] = await Promise.all([
      supabase
        .from('scrap_classifications')
        .select('id, source_history_id, card_id, task_id, order_id, nomenclature_id, order_number, card_sequence, source_operator_name, source_stage_name, classified_at')
        .in('source_history_id', historyChunk),
      supabase
        .from('vkya_restoration_cards')
        .select('*')
        .in('source_history_id', historyChunk)
    ])
    if (classificationResult.error && !isMissingRelation(classificationResult.error)) throw classificationResult.error
    if (restorationResult.error && !isMissingRelation(restorationResult.error)) throw restorationResult.error
    ;(classificationResult.data || []).forEach(row => classificationsById.set(String(row.id), row))
    ;(restorationResult.data || []).forEach(row => {
      const historyId = String(row.source_history_id || '')
      if (historyId) {
        restorationConsumedByHistory.set(
          historyId,
          (restorationConsumedByHistory.get(historyId) || 0) + (Number(row.quantity) || 0)
        )
      }
      if (!row.route_card_id && !row.shop2_card_id) restorationRowsById.set(String(row.id), row)
    })
  }

  for (const taskChunk of chunk(uniqueTaskIds, 40)) {
    const [classificationResult, restorationResult] = await Promise.all([
      supabase
        .from('scrap_classifications')
        .select('id, source_history_id, card_id, task_id, order_id, nomenclature_id, order_number, card_sequence, source_operator_name, source_stage_name, classified_at')
        .in('task_id', taskChunk),
      supabase
        .from('vkya_restoration_cards')
        .select('*')
        .in('source_task_id', taskChunk)
        .is('route_card_id', null)
        .is('shop2_card_id', null)
    ])

    if (classificationResult.error && !isMissingRelation(classificationResult.error)) throw classificationResult.error
    if (restorationResult.error && !isMissingRelation(restorationResult.error)) throw restorationResult.error
    ;(classificationResult.data || []).forEach(row => classificationsById.set(String(row.id), row))
    ;(restorationResult.data || []).forEach(row => restorationRowsById.set(String(row.id), row))
  }
  for (const orderChunk of chunk(uniqueOrderIds, 40)) {
    const [classificationResult, restorationResult] = await Promise.all([
      supabase
        .from('scrap_classifications')
        .select('id, source_history_id, card_id, task_id, order_id, nomenclature_id, order_number, card_sequence, source_operator_name, source_stage_name, classified_at')
        .in('order_id', orderChunk),
      supabase
        .from('vkya_restoration_cards')
        .select('*')
        .in('source_order_id', orderChunk)
        .is('route_card_id', null)
        .is('shop2_card_id', null)
    ])

    if (classificationResult.error && !isMissingRelation(classificationResult.error)) throw classificationResult.error
    if (restorationResult.error && !isMissingRelation(restorationResult.error)) throw restorationResult.error
    ;(classificationResult.data || []).forEach(row => classificationsById.set(String(row.id), row))
    ;(restorationResult.data || []).forEach(row => restorationRowsById.set(String(row.id), row))
  }

  const categoryRowsById = new Map()
  for (const classificationChunk of chunk([...classificationsById.keys()], 100)) {
    const { data, error } = await supabase
      .from('scrap_classification_categories')
      .select('id, classification_id, category, quantity')
      .in('classification_id', classificationChunk)
      .eq('category', 1)
    if (error && !isMissingRelation(error)) throw error
    ;(data || []).forEach(row => categoryRowsById.set(String(row.id), row))
  }

  const allocatedByCategory = new Map()
  const linkedRestorationIds = new Set()
  const restorationScopeById = new Map()
  for (const categoryChunk of chunk([...categoryRowsById.keys()], 100)) {
    const { data, error } = await supabase
      .from('vkya_scrap_lot_allocations')
      .select('classification_category_id, quantity, restoration_card_id')
      .in('classification_category_id', categoryChunk)
    if (error && !isMissingRelation(error)) throw error
    ;(data || []).forEach(row => {
      const categoryId = String(row.classification_category_id)
      allocatedByCategory.set(categoryId, (allocatedByCategory.get(categoryId) || 0) + (Number(row.quantity) || 0))
      if (row.restoration_card_id) {
        const restorationId = String(row.restoration_card_id)
        linkedRestorationIds.add(restorationId)
        const categoryRow = categoryRowsById.get(categoryId)
        const classification = categoryRow && classificationsById.get(String(categoryRow.classification_id))
        const inheritedScope = classification?.source_history_id
          ? quarantineScopeByHistoryId.get(String(classification.source_history_id))
          : null
        if (inheritedScope) restorationScopeById.set(restorationId, inheritedScope)
      }
    })
  }

  for (const restorationChunk of chunk([...linkedRestorationIds], 100)) {
    const { data, error } = await supabase
      .from('vkya_restoration_cards')
      .select('*')
      .in('id', restorationChunk)
      .is('route_card_id', null)
      .is('shop2_card_id', null)
    if (error && !isMissingRelation(error)) throw error
    ;(data || []).forEach(row => restorationRowsById.set(String(row.id), row))
  }

  const reconstructedRecoverableRows = [...categoryRowsById.values()].map(categoryRow => {
    const classification = classificationsById.get(String(categoryRow.classification_id)) || {}
    return {
      ...classification,
      classification_category_id: categoryRow.id,
      available_quantity: getPendingRecoverableQty(categoryRow.quantity, allocatedByCategory.get(String(categoryRow.id)))
    }
  })
  // Prefer the authoritative ledger view; retain the reconstruction only as a
  // compatibility fallback when that view is absent or has not been backfilled.
  const recoverableRows = [...new Map([
    ...reconstructedRecoverableRows.map(row => [String(row.classification_category_id), row]),
    ...[...recoverableLotsByCategoryId.values()].map(row => [String(row.classification_category_id), row])
  ]).values()]
  const restorationRows = [...restorationRowsById.values()]
  const modernCategoryOneHistoryIds = new Set(recoverableRows
    .map(row => row.source_history_id ? String(row.source_history_id) : '')
    .filter(Boolean))

  const items = []

  scopedQuarantineRows.forEach(row => {
    const payload = row?.payload || {}
    const taskId = String(payload.task_id || payload.source_task_id || '')
    const orderId = String(payload.order_id || payload.source_order_id || '')
    const nomenclatureId = String(payload.nomenclature_id || '')
    const scopeMatch = getScopeMatch(taskId, orderId)
    if (!scopeMatch || !nomenclatureId) return
    const total = Number(payload.scrap_qty ?? payload.quantity) || 0
    const resolved = Number(payload.classified_quantity) || 0
    const quantity = Math.max(0, total - resolved)
    if (quantity <= 0) return
    items.push({
      id: `vkya-quarantine-${row.source_type}-${row.source_id}`,
      source_type: 'quarantine',
      source_id: row.source_id,
      task_id: taskId,
      order_id: orderId || null,
      scope_match: scopeMatch,
      nomenclature_id: nomenclatureId,
      quantity,
      status: 'quality-hold',
      operation: 'Карантин ВКЯ',
      card_number: payload.card_number || 'ВКЯ',
      card_info: payload.qc_scrap_comment || 'Очікує рішення ВКЯ',
      created_at: payload.created_at || payload.completed_at || null
    })
  })

  scopedQuarantineRows.forEach(row => {
    if (row.source_type !== 'history' || !row.source_id) return
    const historyId = String(row.source_id)
    if (modernCategoryOneHistoryIds.has(historyId)) return
    const payload = row.payload || {}
    const classifiedAsCategoryOne = getLegacyCategoryOneQuantity(payload.qc_scrap_comment)
    const quantity = Math.max(0, classifiedAsCategoryOne - (restorationConsumedByHistory.get(historyId) || 0))
    if (quantity <= 0) return
    const taskId = payload.task_id || payload.source_task_id || null
    const orderId = payload.order_id || payload.source_order_id || null
    const scopeMatch = getScopeMatch(taskId, orderId)
    if (!scopeMatch || !payload.nomenclature_id) return
    items.push({
      id: `vkya-legacy-recoverable-${historyId}`,
      source_type: 'recoverable',
      source_id: historyId,
      task_id: taskId ? String(taskId) : null,
      order_id: orderId || null,
      scope_match: scopeMatch,
      nomenclature_id: String(payload.nomenclature_id),
      quantity,
      status: 'scrap-cat-1',
      operation: 'Брак категорії 1',
      card_number: payload.card_number || 'ВКЯ',
      card_info: 'Очікує передачі на відновлення',
      created_at: payload.created_at || payload.completed_at || null
    })
  })

  recoverableRows.forEach(row => {
    const inheritedScope = row.source_history_id
      ? quarantineScopeByHistoryId.get(String(row.source_history_id))
      : null
    const scopeMatch = getScopeMatch(row.task_id, row.order_id) || inheritedScope?.scopeMatch
    if (!scopeMatch) return
    const quantity = Math.max(0, Number(row.available_quantity) || 0)
    if (quantity <= 0) return
    items.push({
      id: `vkya-recoverable-${row.classification_category_id}`,
      source_type: 'recoverable',
      source_id: row.classification_category_id,
      task_id: row.task_id ? String(row.task_id) : (inheritedScope?.taskId ? String(inheritedScope.taskId) : null),
      order_id: row.order_id || inheritedScope?.orderId || null,
      scope_match: scopeMatch,
      nomenclature_id: String(row.nomenclature_id || inheritedScope?.nomenclatureId || ''),
      quantity,
      status: 'scrap-cat-1',
      operation: 'Брак категорії 1',
      card_number: row.card_sequence || 'ВКЯ',
      card_info: 'Очікує передачі на відновлення',
      created_at: row.classified_at || null
    })
  })

  restorationRows.forEach(row => {
    const inheritedScope = restorationScopeById.get(String(row.id))
    const scopeMatch = getScopeMatch(row.source_task_id, row.source_order_id) || inheritedScope?.scopeMatch
    if (!scopeMatch) return
    const quantity = row.status === 'completed'
      ? Math.max(0, Number(row.completed_quantity) || 0)
      : Math.max(0, Number(row.quantity) || 0)
    if (quantity <= 0) return
    items.push({
      id: `vkya-restoration-${row.id}`,
      source_type: 'restoration',
      source_id: row.id,
      task_id: row.source_task_id ? String(row.source_task_id) : (inheritedScope?.taskId ? String(inheritedScope.taskId) : null),
      order_id: row.source_order_id || inheritedScope?.orderId || null,
      scope_match: scopeMatch,
      nomenclature_id: String(row.nomenclature_id),
      quantity,
      status: row.status === 'completed' ? 'restoration-completed' : 'restoration',
      operation: row.restoration_stage || 'Відновлення ВКЯ',
      card_number: row.id,
      card_info: row.status === 'completed' ? 'Відновлено, очікує повернення у маршрут' : 'Перебуває на відновленні',
      created_at: row.created_at || row.updated_at || null
    })
  })

  return items
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
  const pageSize = 1000
  const rows = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('vkya_recoverable_scrap_lots')
      .select('*')
      .gt('available_quantity', 0)
      .order('classified_at', { ascending: false })
      .range(from, from + pageSize - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < pageSize) break
  }
  return rows
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
