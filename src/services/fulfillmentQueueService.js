const TASK_FIELDS = 'id,order_id,step,status,planned_sets,estimated_time,engineer_conf,warehouse_conf,director_conf,batch_index,planned_deadline,machine_name,created_at,completed_at,plan_snapshot'

const QUEUE_CONFIG = Object.freeze({
  '/packaging': { queue: 'packaging', openBatchLimit: 300, archiveBatchLimit: 60 },
  '/shipping': { queue: 'shipping', openBatchLimit: 300, archiveBatchLimit: 20 }
})

const isMissingRpcError = (error) => {
  const code = String(error?.code || '')
  const message = String(error?.message || '').toLowerCase()
  const namesMissingRpc = message.includes('mes_fulfillment_queue') || message.includes('mes_next_packing_slip_number')
  return ['PGRST202', '42883'].includes(code) || (
    namesMissingRpc && (
      message.includes('not find') ||
      message.includes('does not exist') ||
      message.includes('schema cache')
    )
  )
}

const uniqueById = (rows = []) => Array.from(
  new Map(rows.filter(row => row?.id).map(row => [String(row.id), row])).values()
)

const flattenRpcBatches = (rows = []) => uniqueById(
  rows.flatMap(row => Array.isArray(row?.tasks) ? row.tasks : [])
)

const fetchCompatibilityQueue = async (client, queue) => {
  // Compatibility is used only while the additive RPC migration has not yet
  // reached an environment. Every query has a hard row cap; a missing RPC can
  // never fall back to downloading the complete task history.
  if (queue === 'packaging') {
    const { data, error } = await client
      .from('tasks')
      .select(TASK_FIELDS)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1000)

    return { data: error ? null : uniqueById(data || []), error }
  }

  const { data, error } = await client
    .from('tasks')
    .select(TASK_FIELDS)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1200)

  return { data: error ? null : uniqueById(data || []), error }
}

export const isFulfillmentRoute = (pathname = '') => Boolean(QUEUE_CONFIG[pathname])

export const fetchFulfillmentTasks = async (client, pathname = '') => {
  const config = QUEUE_CONFIG[pathname]
  if (!config) return { data: null, error: null, source: 'not-applicable' }

  const { data, error } = await client.rpc('mes_fulfillment_queue', {
    p_queue: config.queue,
    p_open_batch_limit: config.openBatchLimit,
    p_archive_batch_limit: config.archiveBatchLimit
  })

  if (!error) {
    return { data: flattenRpcBatches(data || []), error: null, source: 'rpc' }
  }

  if (!isMissingRpcError(error)) {
    return { data: null, error, source: 'rpc-error' }
  }

  const fallback = await fetchCompatibilityQueue(client, config.queue)
  return { ...fallback, source: 'compatibility' }
}

export const fetchMissingOrdersForTasks = async (client, taskRows = [], knownOrders = []) => {
  const knownIds = new Set((knownOrders || []).map(order => String(order?.id || '')).filter(Boolean))
  const missingIds = [...new Set(
    (taskRows || [])
      .map(task => String(task?.order_id || ''))
      .filter(orderId => orderId && !knownIds.has(orderId))
  )]

  if (missingIds.length === 0) return { data: [], error: null }

  const rows = []
  const chunkSize = 50
  for (let start = 0; start < missingIds.length; start += chunkSize) {
    const ids = missingIds.slice(start, start + chunkSize)
    const { data, error } = await client
      .from('orders')
      .select('*, order_items(*)')
      .in('id', ids)

    if (error) return { data: rows, error }
    rows.push(...(data || []))
  }

  return { data: uniqueById(rows), error: null }
}

export const claimNextPackingSlipNumber = async (client) => {
  const { data, error } = await client.rpc('mes_next_packing_slip_number')
  if (!error) {
    const value = Number(data)
    return Number.isFinite(value)
      ? { data: value, error: null, source: 'rpc' }
      : { data: null, error: new Error('Invalid packing-slip number returned by database'), source: 'rpc' }
  }

  if (!isMissingRpcError(error)) return { data: null, error, source: 'rpc-error' }

  // Pre-migration compatibility only. This remains bounded and therefore
  // cannot recreate the old normal-path whole-table scan. Atomic allocation
  // starts as soon as the migration is applied.
  const { data: recentShipped, error: fallbackError } = await client
    .from('tasks')
    .select('plan_snapshot')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .limit(500)

  if (fallbackError) return { data: null, error: fallbackError, source: 'compatibility' }

  const maxValue = (recentShipped || []).reduce((max, task) => {
    const value = Number(task?.plan_snapshot?._metadata?.packing_slip_number)
    return Number.isFinite(value) ? Math.max(max, value) : max
  }, 856)

  return { data: maxValue + 1, error: null, source: 'compatibility' }
}

export { TASK_FIELDS as FULFILLMENT_TASK_FIELDS }
