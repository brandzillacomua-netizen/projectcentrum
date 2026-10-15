import { buildRerunToParentOrderMap } from '../../Shop2CardGen/utils/shop2BufferCalculations'

const asId = value => String(value || '')

/**
 * Packaging is a commercial-order view. Technical rerun orders (-Д1, -Д2...)
 * therefore belong to the same packaging scope as their parent order.
 */
export function buildPackagingOrderScope(orders = []) {
  const uniqueOrders = Array.from(
    new Map((orders || []).filter(order => order?.id).map(order => [asId(order.id), order])).values()
  )
  const ordersById = new Map(uniqueOrders.map(order => [asId(order.id), order]))
  const rerunToParent = buildRerunToParentOrderMap(uniqueOrders)
  const effectiveOrderIdById = new Map()
  const scopeOrderIdsByParent = new Map()

  uniqueOrders.forEach(order => {
    const sourceId = asId(order.id)
    const parentId = rerunToParent.get(sourceId) || sourceId
    effectiveOrderIdById.set(sourceId, parentId)
    if (!scopeOrderIdsByParent.has(parentId)) scopeOrderIdsByParent.set(parentId, new Set([parentId]))
    scopeOrderIdsByParent.get(parentId).add(sourceId)
  })

  return { ordersById, effectiveOrderIdById, scopeOrderIdsByParent }
}

export function getPackagingOrderContext(orderId, scope) {
  const sourceOrderId = asId(orderId)
  const orderIdMap = scope?.effectiveOrderIdById || new Map()
  const parentOrderId = orderIdMap.get(sourceOrderId) || sourceOrderId
  const scopeIds = scope?.scopeOrderIdsByParent?.get(parentOrderId) || new Set([parentOrderId])

  return {
    sourceOrderId,
    parentOrderId,
    parentOrder: scope?.ordersById?.get(parentOrderId) || scope?.ordersById?.get(sourceOrderId) || null,
    scopeOrderIds: Array.from(scopeIds)
  }
}

export function isOrderInPackagingScope(orderId, scopeOrderIds = []) {
  const target = asId(orderId)
  return scopeOrderIds.some(id => asId(id) === target)
}

export function getParentPackagingPlan(tasks = [], parentOrderId, batchIndex = '', fallbackTask = null) {
  const parentTasks = (tasks || []).filter(task => {
    if (asId(task?.order_id) !== asId(parentOrderId)) return false
    if (!batchIndex) return true
    return !task.batch_index || String(task.batch_index) === String(batchIndex)
  })
  const parentPlan = parentTasks.reduce((max, task) => Math.max(max, Number(task.planned_sets) || 0), 0)
  if (parentPlan > 0) return parentPlan
  if (asId(fallbackTask?.order_id) === asId(parentOrderId)) return Number(fallbackTask?.planned_sets) || 0
  return 0
}
