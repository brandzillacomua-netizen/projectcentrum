import { normalize, parseMaterialName } from '../hooks/useWarehouseComputed.js'

const PREPARED_RE = /підготовлен|подготовлен/i
const UNPREPARED_RE = /непідготовлен|неподготовлен/i

const getPreparationState = (name) => {
  const value = String(name || '')
  if (UNPREPARED_RE.test(value)) return 'unprepared'
  if (PREPARED_RE.test(value)) return 'prepared'
  return null
}

export const getSheetSpec = (name) => {
  const value = String(name || '')
  if (!/(?:^|\s)лист(?:\s|$)/i.test(value)) return null

  const thicknessMatch = value.replace(/,/g, '.').match(/(\d+(?:\.\d+)?)\s*мм/i)
  if (!thicknessMatch) return null

  const gradeMatch = value.match(/[тt]\s*(300|700)\b/i)
  return {
    thickness: Number(thicknessMatch[1]),
    grade: gradeMatch?.[1] || null,
    preparation: getPreparationState(value)
  }
}

const getRequestNames = (req, nomenclatures, inventory) => {
  const nom = req?.nomenclature_id
    ? (nomenclatures || []).find(n => String(n.id) === String(req.nomenclature_id))
    : null
  const inv = req?.inventory_id
    ? (inventory || []).find(i => String(i.id) === String(req.inventory_id))
    : null

  return [nom?.name, inv?.name, parseMaterialName(req?.details)]
    .map(name => String(name || '').trim())
    .filter(Boolean)
}

export const getRequestSheetSpec = (req, nomenclatures, inventory) => {
  const specs = getRequestNames(req, nomenclatures, inventory)
    .map(getSheetSpec)
    .filter(Boolean)

  if (specs.length === 0) return null

  // References are authoritative when they contain extra information (for
  // example T300), while a generic details label may only say "Лист (6мм)".
  return {
    thickness: specs.find(spec => Number.isFinite(spec.thickness))?.thickness,
    grade: specs.find(spec => spec.grade)?.grade || null,
    preparation: specs.find(spec => spec.preparation)?.preparation || null
  }
}

export const sheetSpecsAreCompatible = (requestSpec, inventorySpec) => {
  if (!requestSpec || !inventorySpec) return false
  if (requestSpec.thickness !== inventorySpec.thickness) return false
  if (requestSpec.grade && requestSpec.grade !== inventorySpec.grade) return false
  if (requestSpec.preparation && requestSpec.preparation !== inventorySpec.preparation) return false
  return true
}

export const inventoryMatchesRequest = (item, req, nomenclatures, inventory) => {
  if (!item || !req) return false
  if (req.inventory_id && String(item.id) === String(req.inventory_id)) return true
  if (req.nomenclature_id && String(item.nomenclature_id) === String(req.nomenclature_id)) return true

  const requestNames = getRequestNames(req, nomenclatures, inventory)
  const itemName = String(item.name || '')
  const normalizedItemName = normalize(itemName)

  if (requestNames.some(name => normalize(name) === normalizedItemName)) return true

  const requestSheetSpec = getRequestSheetSpec(req, nomenclatures, inventory)
  if (sheetSpecsAreCompatible(requestSheetSpec, getSheetSpec(itemName))) return true

  // Backwards compatibility for non-sheet requests whose stock row only adds
  // the preparation suffix or a trailing parenthesized note.
  return requestNames.some(name => {
    const normalizedRequestName = normalize(name)
    const withoutPreparation = itemName
      .replace(/\s*\[(?:не)?підготовлений\]\s*/gi, ' ')
      .replace(/\s*\[(?:не)?подготовленный\]\s*/gi, ' ')
      .trim()
    if (normalize(withoutPreparation) === normalizedRequestName) return true
    return normalize(itemName.replace(/\s*\([^)]*\)$/, '')) === normalizedRequestName
  })
}

export const availableInventoryForRequest = (req, inventory, nomenclatures, warehouse = 'operational') => {
  return (inventory || []).filter(item => {
    if (warehouse === 'operational' && item.warehouse !== 'operational' && item.warehouse) return false
    return inventoryMatchesRequest(item, req, nomenclatures, inventory)
  })
}
