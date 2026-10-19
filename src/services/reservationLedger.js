const TERMINAL_TASK_STATUSES = new Set(['completed', 'cancelled', 'archived'])
const TERMINAL_ORDER_STATUSES = new Set(['completed', 'delivered', 'shipped', 'cancelled', 'archived'])

const normalizeStatus = value => String(value || '').toLowerCase().trim()

export function requestBelongsToOpenWork(request, tasks = [], orders = []) {
  const task = request?.task_id
    ? tasks.find(item => String(item.id) === String(request.task_id))
    : null
  const order = request?.order_id
    ? orders.find(item => String(item.id) === String(request.order_id))
    : null

  if (task && TERMINAL_TASK_STATUSES.has(normalizeStatus(task.status))) return false
  if (order && TERMINAL_ORDER_STATUSES.has(normalizeStatus(order.status))) return false
  return true
}

export function selectIssuedRequestsForInventory(requests = [], inventoryId, tasks = [], orders = []) {
  if (!inventoryId) return []
  return requests.filter(request =>
    request?.status === 'issued' &&
    String(request.inventory_id || '') === String(inventoryId) &&
    (Number(request.quantity) || 0) > 0 &&
    requestBelongsToOpenWork(request, tasks, orders)
  )
}

export function sumRequestQuantity(requests = []) {
  return requests.reduce((sum, request) => sum + (Number(request?.quantity) || 0), 0)
}
