export const QUALITY_DISPOSITIONS = Object.freeze({
  RETURNED_TO_ROUTE: 'returned_to_route',
  RESTORATION_ASSIGNED: 'restoration_assigned',
  FINAL_SCRAP_CATEGORY: 4
})

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

