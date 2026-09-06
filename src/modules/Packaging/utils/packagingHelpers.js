// ─── Колір для номера коробки (щоб однакові коробки виділялись однаково) ───────
export const BOX_COLORS = [
  '#a855f7', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b',
  '#10b981', '#6366f1', '#d946ef', '#84cc16', '#0ea5e9'
]

export function getBoxColor(boxNum) {
  if (!boxNum) return '#333'
  let hash = 0
  for (let i = 0; i < boxNum.length; i++) hash = boxNum.charCodeAt(i) + ((hash << 5) - hash)
  return BOX_COLORS[Math.abs(hash) % BOX_COLORS.length]
}

// ─── Detect category key from nomenclature ────────────────────────────────────
export function detectCategoryKey(nom) {
  if (!nom) return 'other'
  const name = (nom.name || '').toLowerCase()
  const type = (nom.type || '').toLowerCase()
  if (name.includes('кріплення') || name.includes('друк') || name.includes('3д')) return 'mounts'
  if (name.includes('стійка') || type.includes('стійк')) return 'spacers'
  if (name.includes('накладка') || name.includes('тримач') || name.includes('упаковка') || name.includes('пакет') || name.includes('гума')) return 'other'
  if (type.includes('метиз') || type.includes('гвинт') || type.includes('гайка') || name.includes('гвинт') || name.includes('гайка') || type.includes('hardware') || type.includes('fastener')) return 'hardware'
  if (name.includes('-іп') || name.includes(' іп') || type.includes('part') || type.includes('деталь') || type.includes('виріб') || type.includes('сгп')) return 'sgp'
  return 'other'
}

export function isFinishedComponent(nom) {
  if (!nom) return false
  const name = (nom?.name || '').toLowerCase()
  const code = (nom?.nomenclature_code || '').toLowerCase()
  const type = (nom?.type || '').toLowerCase()
  return name.includes('-іп') || name.includes(' іп') || code.includes('іп') ||
    type.includes('part') || type.includes('деталь') || type.includes('виріб') ||
    type.includes('product') || type.includes('сгп')
}

export function isProductionOnlyMaterial(nom) {
  if (!nom) return false
  const name = (nom?.name || '').toLowerCase()
  const type = (nom?.type || '').toLowerCase()
  const isRubberPackaging = name.includes('гума') || name.includes('rubber')
  const isSheetMaterial = !isRubberPackaging && (name.includes('лист') || name.includes('sheet') || type.includes('sheet'))
  return isSheetMaterial || name.includes('фрез') || type.includes('cutter')
}

export const REQUEST_STATUS_PRIORITY = {
  completed: 4,
  issued: 3,
  processing: 2,
  pending: 1
}

export function getBestRequestForNomenclature(requests, nomenclatureId) {
  if (!requests || !nomenclatureId) return null
  return requests
    .filter(request => String(request.nomenclature_id) === String(nomenclatureId))
    .sort((a, b) => (REQUEST_STATUS_PRIORITY[b.status] || 0) - (REQUEST_STATUS_PRIORITY[a.status] || 0))[0]
}
