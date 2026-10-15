import { resolveCanonicalNomId } from '../Nomenclature/utils/nomenclatureHelpers.js'

// Keep inventory identity stable across Cyrillic/Latin homoglyphs and spacing variants.
export const normalizeKey = str => (str || '')
  .trim()
  .toLowerCase()
  .replace(/[\s_-]+/g, '-')
  .replace(/[аa]/g, 'a')
  .replace(/[вb]/g, 'b')
  .replace(/[еe]/g, 'e')
  .replace(/[кk]/g, 'k')
  .replace(/[мm]/g, 'm')
  .replace(/[нh]/g, 'h')
  .replace(/[оo]/g, 'o')
  .replace(/[рp]/g, 'p')
  .replace(/[сc]/g, 'c')
  .replace(/[тt]/g, 't')
  .replace(/[хx]/g, 'x')

export const isHardware = item => {
  const type = (item.type || '').toLowerCase()
  const nameLower = (item.name || '').toLowerCase()
  return (
    type === 'hardware' || type === 'fastener' || type === 'mount' ||
    nameLower.includes('гвинт') || nameLower.includes('гайка') || nameLower.includes('болт') ||
    nameLower.includes('шайба') || nameLower.includes('стійка') || nameLower.includes('накладка') ||
    nameLower.includes('тримач') || nameLower.includes('метиз') || nameLower.includes('кріплення') ||
    nameLower.includes('саморіз') || nameLower.includes('втулка') || nameLower.includes('фіксатор')
  )
}

const SGP_DETAIL_TYPES = new Set([
  'finished', 'part', 'product', 'bz', 'bz_shop2', 'wip_bz', 'semi', 'semi_shop2'
])

export const isSgpStockRow = item => {
  if (!item) return false
  const type = String(item.type || '').toLowerCase()
  const nameLower = String(item.name || '').toLowerCase()
  return !isHardware(item) && (
    SGP_DETAIL_TYPES.has(type) || nameLower.includes('бз') || nameLower.includes('буфер')
  )
}

export const getAvailableStockByNomenclatureId = (inventory, nomenclatureId) => {
  if (!nomenclatureId) return 0
  const matchingRows = (inventory || [])
    .filter(item =>
      String(item.nomenclature_id) === String(nomenclatureId) && isSgpStockRow(item)
    )

  const stockRow = matchingRows.sort((a, b) => {
    const availableA = (Number(a.total_qty) || 0) - (Number(a.reserved_qty) || 0)
    const availableB = (Number(b.total_qty) || 0) - (Number(b.reserved_qty) || 0)
    return availableB - availableA
  })[0]

  return stockRow
    ? Math.max(0, (Number(stockRow.total_qty) || 0) - (Number(stockRow.reserved_qty) || 0))
    : 0
}

export const getGroupedSgpRow = (groupedItems, nomenclatures, request) => {
  if (!request?.nomenclature_id) return 0
  const requestNomId = resolveCanonicalNomId(request.nomenclature_id, nomenclatures)
  return (groupedItems || []).find(item => (
    resolveCanonicalNomId(item.nomenclature_id, nomenclatures) === requestNomId
  )) || null
}

export const getGroupedSgpAvailableStock = (groupedItems, nomenclatures, request) => {
  const groupedRow = getGroupedSgpRow(groupedItems, nomenclatures, request)

  return groupedRow
    ? Math.max(0, (Number(groupedRow.total_qty) || 0) - (Number(groupedRow.reserved_qty) || 0))
    : 0
}

export const getGroupedSgpIssueRow = (groupedItems, nomenclatures, request) => {
  const groupedRow = getGroupedSgpRow(groupedItems, nomenclatures, request)
  return (groupedRow?.rawItems || [])
    .filter(isSgpStockRow)
    .sort((a, b) => {
      const availableA = (Number(a.total_qty) || 0) - (Number(a.reserved_qty) || 0)
      const availableB = (Number(b.total_qty) || 0) - (Number(b.reserved_qty) || 0)
      return availableB - availableA
    })[0] || null
}

export const getGroupedSgpIssueAllocations = (groupedItems, nomenclatures, request, requestedQty) => {
  const groupedRow = getGroupedSgpRow(groupedItems, nomenclatures, request)
  const rows = (groupedRow?.rawItems || [])
    .filter(isSgpStockRow)
    .map(item => ({
      item,
      availableQty: Math.max(0, (Number(item.total_qty) || 0) - (Number(item.reserved_qty) || 0))
    }))
    .filter(entry => entry.availableQty > 0)
    .sort((a, b) => b.availableQty - a.availableQty)

  let remainingQty = Math.max(0, Number(requestedQty) || 0)
  const allocations = []
  rows.forEach(entry => {
    if (remainingQty <= 0) return
    const quantity = Math.min(entry.availableQty, remainingQty)
    allocations.push({ inventory: entry.item, quantity })
    remainingQty -= quantity
  })

  return {
    allocations,
    availableQty: rows.reduce((sum, entry) => sum + entry.availableQty, 0),
    remainingQty
  }
}
