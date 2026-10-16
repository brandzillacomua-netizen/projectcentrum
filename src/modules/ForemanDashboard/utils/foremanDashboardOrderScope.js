import { isRerunOrder } from '../../Shop2CardGen/utils/shop2BufferCalculations.js'

/**
 * Technical rerun orders (for example 261001-5-Д1) restore Shop 2 scrap.
 * They have their own cards, but must never become independent commercial
 * orders or increase demand in the foreman dashboard.
 */
export const isTechnicalRerunTask = (task, ordersMap) => {
  if (!task?.order_id) return false
  return isRerunOrder(ordersMap?.[task.order_id])
}

export const filterCommercialDashboardTasks = (tasks = [], ordersMap = {}) =>
  tasks.filter(task => !isTechnicalRerunTask(task, ordersMap))

