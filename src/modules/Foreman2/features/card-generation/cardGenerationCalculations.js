const positiveNumber = value => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

const sheetsFromQuantity = (quantity, unitsPerSheet) => {
  const qty = positiveNumber(quantity)
  if (qty <= 0) return 0
  return Math.ceil(qty / Math.max(1, positiveNumber(unitsPerSheet) || 1))
}

export const findPartSnapshot = (task, part, nomenclatureId) => {
  const snapshot = task?.plan_snapshot || {}
  const candidateIds = new Set([
    part?.nomId,
    part?.id,
    part?.nom?.id,
    nomenclatureId
  ].filter(Boolean).map(String))

  for (const id of candidateIds) {
    const direct = snapshot[id]
    if (direct && typeof direct === 'object') return direct
  }

  return Object.entries(snapshot).find(([key, entry]) => {
    if (!entry || typeof entry !== 'object' || key.startsWith('_')) return false
    return candidateIds.has(String(entry.id || ''))
  })?.[1] || null
}

export const resolvePlannedSheetsForGeneration = ({
  task,
  part,
  nomenclatureId,
  unitsPerSheet,
  requestedSheets
}) => {
  const snapshotEntry = findPartSnapshot(task, part, nomenclatureId)

  const plannedSheets = [
    snapshotEntry?.sheets,
    part?.plannedSheets,
    sheetsFromQuantity(snapshotEntry?.plan, unitsPerSheet),
    sheetsFromQuantity(part?.plan, unitsPerSheet),
    requestedSheets
  ].map(positiveNumber).find(value => value > 0) || 0

  return { snapshotEntry, plannedSheets }
}

export const calculateRemainingGenerationSheets = ({ plannedSheets, generatedSheets }) => (
  Math.max(0, positiveNumber(plannedSheets) - Math.max(0, Number(generatedSheets) || 0))
)
