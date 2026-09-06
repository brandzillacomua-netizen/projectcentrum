/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🏭 PRODUCTION SHARED UTILITIES & CONSTANTS
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const CHAIN_SHOP1 = [
  'Розкрій',
  'Галтовка (Вібростіл)',
  'Галтовка (Мийка)',
  'Галтовка (Галтовка)',
  'Галтовка (Сушка)',
  'Прийомка'
]

export const CHAIN_GENERAL = [
  'Розкрій',
  'Галтовка',
  'Пресування',
  'Фарбування',
  'Пакування'
]

export const getRequestQty = (r) => {
  if (!r) return 0
  if (r.quantity !== null && r.quantity !== undefined) return Number(r.quantity)
  const match = (r.details || '').match(/—\s*(\d+)/)
  return match ? Number(match[1]) : 0
}

export const normalizeName = (s) => {
  if (!s) return ''
  const mapper = {
    'а': 'a', 'в': 'b', 'с': 'c', 'е': 'e', 'н': 'h', 'h': 'h',
    'к': 'k', 'м': 'm', 'о': 'o', 'р': 'p', 'т': 't', 'х': 'x',
    'у': 'y', 'і': 'i', 'ї': 'i', 'и': 'y', 'п': 'p'
  }
  return s.toLowerCase()
    .trim()
    .split('')
    .map(c => mapper[c] || c)
    .join('')
    .replace(/[^a-z0-9]/g, '')
}

export const stripMaterialTags = (s) => (s || '').toLowerCase()
  .replace(/\[\s*підготовлений\s*\]/gi, '')
  .replace(/\[\s*непідготовлений\s*\]/gi, '')
  .trim()

export const isRawMaterialNom = (n) => n && (n.type === 'raw' || n.type === 'material')

export const findExplicitRawMaterialNom = (materialLabel, nomenclatures = []) => {
  const rawLabel = String(materialLabel || '').trim()
  if (!rawLabel) return null

  const lowerLabel = rawLabel.toLowerCase()
  const normalizedLabel = normalizeName(stripMaterialTags(rawLabel))

  return (nomenclatures || []).find(n => {
    if (!isRawMaterialNom(n)) return false
    const name = String(n.name || '').trim()
    const materialType = String(n.material_type || '').trim()
    if (name.toLowerCase() === lowerLabel) return true
    if (materialType && materialType.toLowerCase() === lowerLabel) return true
    if (normalizeName(stripMaterialTags(name)) === normalizedLabel) return true
    if (materialType && normalizeName(stripMaterialTags(materialType)) === normalizedLabel) return true
    return normalizeName(stripMaterialTags(`${name} ${materialType}`)) === normalizedLabel
  }) || null
}
