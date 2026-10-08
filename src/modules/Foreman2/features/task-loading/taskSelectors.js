import { asId, textIncludesAny } from '../../utils/normalize.js'

const SNAPSHOT_META_KEYS = new Set([
  'materialSummary',
  'selectedCutters',
  'consumables',
  'arrivals',
  'nomenclatures'
])

export const isCuttingTask = (task) => {
  const step = String(task?.step || '')
  return textIncludesAny(step, ['розкр', 'різк', 'cut', 'Р РѕР·Рє', 'Р С–Р·Рє'])
}

export const isRelevantForemanTask = (task) => {
  if (!task || task.status === 'completed' || task.status === 'cancelled') return false
  const warehouseReady = task.warehouse_conf === 'true' || task.warehouse_conf === 'partial'
  return warehouseReady && task.engineer_conf === true && task.director_conf === true && isCuttingTask(task)
}

export const getOrderForTask = (task, orders = [], allOrdersMap = {}) => {
  return task?.orders
    || orders.find(order => asId(order.id) === asId(task?.order_id))
    || allOrdersMap[asId(task?.order_id)]
    || null
}

export const getSnapshotPartEntries = (task, nomenclatures = []) => {
  const snapshot = task?.plan_snapshot || {}
  const findNom = (key) => {
    const normKey = asId(key).toLowerCase()
    return (nomenclatures || []).find(n => {
      if (!n) return false
      if (asId(n.id).toLowerCase() === normKey) return true
      if (asId(n.code).toLowerCase() === normKey) return true
      if (asId(n.nomenclature_code).toLowerCase() === normKey) return true
      if (Array.isArray(n.legacy_ids) && n.legacy_ids.some(leg => asId(leg).toLowerCase() === normKey)) return true
      return false
    })
  }

  return Object.entries(snapshot)
    .filter(([key, value]) => {
      if (!value || typeof value !== 'object') return false
      if (key.startsWith('_') || SNAPSHOT_META_KEYS.has(key)) return false
      const nom = findNom(key)
      return !nom || nom.type === 'part' || value.type === 'part' || value.need !== undefined
    })
    .map(([nomId, value]) => {
      const nom = findNom(nomId)
      return {
        nomId: asId(nomId),
        nom,
        snapshot: value,
        name: nom?.name || value.name || value.code || nomId
      }
    })
}

export const getTaskDisplayName = (task, order) => {
  const base = order?.order_num || task?.plan_snapshot?._prep_num || task?.id || 'Без номера'
  return task?.batch_index ? `${base}/${task.batch_index}` : base
}
