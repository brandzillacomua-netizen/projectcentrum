export const QUALITY_DISPOSITIONS = Object.freeze({
  RETURNED_TO_ROUTE: 'returned_to_route',
  RESTORATION_ASSIGNED: 'restoration_assigned',
  FINAL_SCRAP_CATEGORY: 4
})

export const QUALITY_CLASSIFICATION_OPTIONS = Object.freeze([
  { category: 1, label: 'Брак', color: '#eab308', description: 'Брак або деталі, які можна передати на доопрацювання' },
  { category: 4, label: 'Утиль', color: '#ef4444', description: 'Безнадійний брак для остаточного списання' }
])

const id = value => value === null || value === undefined ? '' : String(value)
const qty = value => Math.max(0, Number(value) || 0)

export const buildQualityLossIndex = (rows = []) => {
  const byTask = {}
  const byCard = {}

  rows.filter(Boolean).forEach(row => {
    const taskId = id(row.task_id)
    const cardId = id(row.card_id)
    const nomId = id(row.nomenclature_id)
    const finalScrap = qty(row.total_scrap)
    if (!nomId || finalScrap <= 0) return

    if (taskId) {
      if (!byTask[taskId]) byTask[taskId] = {}
      byTask[taskId][nomId] = (byTask[taskId][nomId] || 0) + finalScrap
    }
    if (cardId) byCard[cardId] = (byCard[cardId] || 0) + finalScrap
  })

  return { byTask, byCard }
}

export const getFinalScrapForTaskPart = (index, taskId, nomenclatureId) => {
  return qty(index?.byTask?.[id(taskId)]?.[id(nomenclatureId)])
}

export const asScrapTotalRows = (rows = []) => rows.map((row, index) => ({
  id: `vkya-final-${id(row.task_id)}-${id(row.card_id) || index}-${id(row.nomenclature_id)}`,
  ...row,
  total_scrap: qty(row.total_scrap),
  is_vkya_final_scrap: true
}))

export const buildQualityStatusTotals = (inventory = [], quarantineItems = []) => {
  const inventoryTotal = types => inventory
    .filter(item => types.includes(item?.type))
    .reduce((sum, item) => sum + qty(item?.total_qty), 0)

  return {
    quarantine: quarantineItems.reduce((sum, item) => sum + qty(item?.total_qty), 0),
    recoverableScrap: inventoryTotal(['scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3']),
    finalScrap: inventoryTotal(['scrap_cat_4']),
    restoration: inventoryTotal(['scrap_restoration'])
  }
}

const recoverableStorageType = value => value === 'scrap_cat_2' ? 'scrap_cat_2' : 'scrap_cat_1'

const F10_PURGED_NOM_IDS = new Set([
  '5ecf63e5-802d-4f98-8291-aad9a52bfaa4',
  '50947afc-4e40-4165-a682-780275d5feda',
  '343417a7-4a5c-4e31-8f44-18abb41defec',
  'b77e0883-0af2-40a4-a834-a1e47b6570da'
])

export const buildRecoverableScrapLotItems = (rows = []) => rows
  .filter(row => {
    if (qty(row?.available_quantity) <= 0) return false
    if (F10_PURGED_NOM_IDS.has(String(row?.nomenclature_id))) return false
    if (String(row?.order_number || '').trim() === '14082026-01') return false
    return true
  })
  .map(row => ({
    ...row,
    id: `vkya-lot-${id(row.classification_category_id)}`,
    name: row.nomenclature_name || row.name || 'Деталь',
    type: recoverableStorageType(row.storage_type),
    total_qty: qty(row.available_quantity),
    is_classified_lot: true,
    operator: row.source_operator_name,
    stage: row.source_stage_name,
    updated_at: row.classified_at,
    naryad_number: row.order_number || '—'
  }))

export const buildLegacyRecoverableInventoryItems = (inventory = [], lotRows = []) => {
  const covered = new Map()
  lotRows.forEach(row => {
    const key = `${id(row?.nomenclature_id)}|${recoverableStorageType(row?.storage_type)}`
    covered.set(key, (covered.get(key) || 0) + qty(row?.available_quantity))
  })

  return inventory
    .filter(item => ['scrap_cat_1', 'scrap_cat_2', 'scrap_cat_3'].includes(item?.type) && qty(item?.total_qty) > 0)
    .map(item => {
      const type = recoverableStorageType(item.type)
      const key = `${id(item.nomenclature_id)}|${type}`
      const represented = covered.get(key) || 0
      const consumed = Math.min(qty(item.total_qty), represented)
      covered.set(key, represented - consumed)
      const remainder = qty(item.total_qty) - consumed
      return remainder > 0 ? {
        ...item,
        id: `legacy-${id(item.id)}`,
        inventory_id: item.id,
        type,
        total_qty: remainder,
        is_legacy_aggregate: true
      } : null
    })
    .filter(Boolean)
}
