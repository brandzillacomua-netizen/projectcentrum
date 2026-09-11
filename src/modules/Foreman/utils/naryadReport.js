const asId = value => value === null || value === undefined ? '' : String(value)
const qty = value => Math.max(0, Number(value) || 0)

export const NARYAD_REPORT_SNAPSHOT_VERSION = 3

export const uniqueReportRows = (rows = []) => Array.from(new Map(
  rows
    .filter(Boolean)
    .map((row, index) => [asId(row.id) || `${asId(row.card_id)}:${asId(row.nomenclature_id)}:${index}`, row])
).values())

export const scopeReportCards = (cards = [], taskId, orderId) => {
  const wantedTaskId = asId(taskId)
  const wantedOrderId = asId(orderId)

  return uniqueReportRows(cards).filter(card => {
    if (asId(card.task_id) !== wantedTaskId) return false
    const cardOrderId = asId(card.order_id)
    return !wantedOrderId || !cardOrderId || cardOrderId === wantedOrderId
  })
}

export const calculateActualSheetsForPart = ({
  cards = [],
  taskId,
  orderId,
  nomenclatureId,
  unitsPerSheet = 1
}) => {
  const ups = Math.max(1, Number(unitsPerSheet) || 1)
  const partId = asId(nomenclatureId)
  const partCards = scopeReportCards(cards, taskId, orderId).filter(card => {
    if (asId(card.nomenclature_id) !== partId) return false
    if (String(card.operation || '').trim() === 'Склад БЗ') return false
    return !String(card.card_info || '').includes('[REDO]')
  })

  return partCards.reduce((sum, card) => {
    const explicitSheets = Number(card.actual_sheets ?? card.actualSheets)
    if (Number.isFinite(explicitSheets) && explicitSheets > 0) return sum + explicitSheets

    const requiredQtyMatch = String(card.card_info || '').match(/\[REQ:(\d+)\]/)
    const loadedQty = requiredQtyMatch ? qty(requiredQtyMatch[1]) : qty(card.quantity)
    return sum + (loadedQty > 0 ? Math.ceil(loadedQty / ups) : 0)
  }, 0)
}

export const scopeReportSupplementalRows = (rows, { taskId, orderId, cardIds }) => uniqueReportRows(rows).filter(row => {
  if (asId(row.task_id) && asId(row.task_id) !== asId(taskId)) return false
  if (asId(orderId) && asId(row.order_id) && asId(row.order_id) !== asId(orderId)) return false

  const linkedCardId = asId(row.card_id || row.source_card_id)
  return !linkedCardId || cardIds.has(linkedCardId)
})

export const buildNaryadScrapSummary = ({
  cards = [],
  historyRows = [],
  finalScrapRows = [],
  returnedRows = [],
  taskId,
  orderId,
  hasFinalScrapProjection = false,
  legacyBreakdown = null
}) => {
  const scopedCards = scopeReportCards(cards, taskId, orderId)
  const cardIds = new Set(scopedCards.map(card => asId(card.id)))
  const scopedHistory = uniqueReportRows(historyRows).filter(row => cardIds.has(asId(row.card_id)))
  const total = scopedHistory.reduce((sum, row) => sum + qty(row.scrap_qty), 0)

  if (!hasFinalScrapProjection) {
    const fallback = legacyBreakdown || {}
    const returned = Math.min(total, qty(fallback.returned))
    const inVkya = Math.min(Math.max(0, total - returned), qty(fallback.inVkyaQty))
    const restoration = Math.min(Math.max(0, total - returned - inVkya), qty(fallback.toRestoreQty))
    return {
      total,
      util: Math.max(0, total - returned - inVkya - restoration),
      restoration,
      inVkya,
      returned
    }
  }

  const util = Math.min(total, scopeReportSupplementalRows(finalScrapRows, { taskId, orderId, cardIds })
    .reduce((sum, row) => sum + qty(row.total_scrap), 0))
  const returned = Math.min(Math.max(0, total - util), scopeReportSupplementalRows(returnedRows, { taskId, orderId, cardIds })
    .filter(row => !row.disposition || row.disposition === 'returned_to_route')
    .reduce((sum, row) => sum + qty(row.quantity), 0))
  const restoration = 0

  return {
    total,
    util,
    restoration,
    inVkya: Math.max(0, total - util - returned - restoration),
    returned
  }
}

export const summarizeReportParts = (parts = []) => (parts || []).reduce((summary, part) => {
  const total = qty(part?.observedScrap)
  const util = Math.min(total, qty(part?.scrap))
  const returned = Math.min(Math.max(0, total - util), qty(part?.returnedVkya))
  const inVkya = Math.min(Math.max(0, total - util - returned), qty(part?.qualityHold))
  const restoration = Math.max(0, total - util - returned - inVkya)

  summary.total += total
  summary.util += util
  summary.returned += returned
  summary.inVkya += inVkya
  summary.restoration += restoration
  return summary
}, { total: 0, util: 0, restoration: 0, inVkya: 0, returned: 0 })

export const reconcileScrapDetailRows = ({ parts = [], rows = [] } = {}) => {
  const detailRows = uniqueReportRows(rows)
  const rowTotalsByNom = {}
  const expectedGrandTotal = (parts || []).reduce((sum, part) => sum + qty(part?.observedScrap), 0)
  const detailedGrandTotal = detailRows.reduce((sum, row) => sum + qty(row.scrap_qty ?? row.scrapQty), 0)
  let remainingDifference = Math.max(0, expectedGrandTotal - detailedGrandTotal)

  detailRows.forEach(row => {
    const nomId = asId(row.nomenclature_id || row.nomId)
    if (!nomId) return
    rowTotalsByNom[nomId] = (rowTotalsByNom[nomId] || 0) + qty(row.scrap_qty ?? row.scrapQty)
  })

  const reconciliationRows = (parts || []).flatMap(part => {
    if (remainingDifference <= 0) return []
    const nomId = asId(part?.nomId || part?.nomenclature_id)
    if (!nomId) return []

    const partDifference = Math.max(0, qty(part?.observedScrap) - (rowTotalsByNom[nomId] || 0))
    const difference = Math.min(partDifference, remainingDifference)
    if (difference <= 0) return []
    remainingDifference -= difference

    return [{
      id: `archive-reconciliation:${asId(part?.taskId)}:${nomId}`,
      task_id: part?.taskId,
      nomenclature_id: nomId,
      stage_name: 'Архів карток / ВКЯ',
      operator_name: 'Система обліку',
      scrap_qty: difference,
      source: 'archive_reconciliation'
    }]
  })

  return [...detailRows, ...reconciliationRows]
}

export const summarizeReportProduction = (parts = []) => {
  const rows = (parts || []).map(part => {
    const cards = uniqueReportRows(part?.cards || [])
    const fromBz = cards
      .filter(card => String(card?.operation || '').trim() === 'Склад БЗ')
      .filter(card => ['completed', 'at-shop2-buffer', 'at-buffer', 'waiting-buffer'].includes(card?.status))
      .reduce((sum, card) => sum + qty(card?.quantity), 0)
    const acceptedTotal = qty(part?.produced)
    const acceptedFromBz = Math.min(acceptedTotal, fromBz)

    return {
      nomenclatureId: asId(part?.nomId || part?.nomenclature_id),
      name: part?.name || part?.nom?.name || 'Невідома деталь',
      code: part?.code || part?.nom?.nomenclature_code || 'БЕЗ КОДУ',
      need: qty(part?.need),
      plannedBz: qty(part?.stockBZ),
      plannedShop1: qty(part?.plan),
      fromBz: acceptedFromBz,
      fromShop1: Math.max(0, acceptedTotal - acceptedFromBz),
      acceptedTotal
    }
  })

  return rows.reduce((summary, row) => {
    summary.need += row.need
    summary.plannedBz += row.plannedBz
    summary.plannedShop1 += row.plannedShop1
    summary.fromBz += row.fromBz
    summary.fromShop1 += row.fromShop1
    summary.acceptedTotal += row.acceptedTotal
    return summary
  }, { need: 0, plannedBz: 0, plannedShop1: 0, fromBz: 0, fromShop1: 0, acceptedTotal: 0, rows })
}
