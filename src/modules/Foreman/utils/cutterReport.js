const normalizeName = value => String(value || '').toLowerCase().replace(/,/g, '.').replace(/\s+/g, ' ').trim()

export const getCutterDiameter = (name = '') => {
  const normalized = normalizeName(name)
  const direct = normalized.match(/ф\s*([0-9]+(?:\.[0-9]+)?)/)
  if (direct) return Number(direct[1])
  const bySize = normalized.match(/(?:кукурудза|двопера|однопера|спіральна|торцева|шарова|радіусна)?\s*([0-9][0-9.]*)(?:\s*[×xх])/)
  return bySize ? Number(bySize[1]) : null
}

export const isConcreteCutterName = name => {
  const normalized = normalizeName(name)
  if (!normalized.includes('фрез')) return false
  if (/^(?:тип\s*)?фреза(?:\s*(?:тип\s*)?ф?\s*[0-9.]+(?:\s*\([^)]*\))?)?$/.test(normalized)) return false
  if (/^тип\s+ф\s*[0-9.]+(?:\s*\([^)]*\))?$/.test(normalized)) return false
  return true
}

const parseCutterNameFromDetails = details => {
  const match = String(details || '').match(/(фреза\s+.+?)(?=\s+[—-]\s*\d|$)/i)
  const name = match?.[1]?.trim() || ''
  return isConcreteCutterName(name) ? name : null
}

const getDeclaredQuantity = request => {
  const matches = [...String(request?.details || '').matchAll(/[—-]\s*(\d+(?:[.,]\d+)?)\s*(?:шт|од(?:\.|иниц(?:я|і|ь))?|$)/gi)]
  const rawDeclared = matches.at(-1)?.[1]
  const declared = rawDeclared ? Number(rawDeclared.replace(',', '.')) : 0
  return declared > 0 ? declared : Math.max(0, Number(request?.quantity) || 0)
}

export function resolveRequestedCutterName(request, inventory = [], nomenclatures = []) {
  const inventoryRow = request?.inventory_id
    ? inventory.find(item => String(item.id) === String(request.inventory_id))
    : null
  if (isConcreteCutterName(inventoryRow?.name)) return inventoryRow.name.trim()

  const inventoryNomenclature = inventoryRow?.nomenclature_id
    ? nomenclatures.find(item => String(item.id) === String(inventoryRow.nomenclature_id))
    : null
  if (isConcreteCutterName(inventoryNomenclature?.name)) return inventoryNomenclature.name.trim()

  const joinedName = request?.nomenclature?.name
  if (isConcreteCutterName(joinedName)) return joinedName.trim()

  const nomenclature = request?.nomenclature_id
    ? nomenclatures.find(item => String(item.id) === String(request.nomenclature_id))
    : null
  if (isConcreteCutterName(nomenclature?.name)) return nomenclature.name.trim()

  return parseCutterNameFromDetails(request?.details)
}

export function buildRequestedCuttersBreakdown(requests = [], inventory = [], nomenclatures = []) {
  return requests.reduce((result, request) => {
    const status = String(request?.status || '').toLowerCase()
    if (['cancelled', 'rejected'].includes(status)) return result
    const name = resolveRequestedCutterName(request, inventory, nomenclatures)
    const quantity = getDeclaredQuantity(request)
    if (!name || quantity <= 0) return result
    result[name] = (result[name] || 0) + quantity
    return result
  }, {})
}

export function resolveActualCutterToRequested(actualName, requestedNames = []) {
  const normalizedActual = normalizeName(actualName)
  const exact = requestedNames.find(name => normalizeName(name) === normalizedActual)
  if (exact) return exact

  const diameter = getCutterDiameter(actualName)
  if (!Number.isFinite(diameter)) return null
  const candidates = requestedNames.filter(name => {
    const requestedDiameter = getCutterDiameter(name)
    return Number.isFinite(requestedDiameter) && Math.abs(requestedDiameter - diameter) < 0.001
  })
  return candidates.length === 1 ? candidates[0] : null
}
