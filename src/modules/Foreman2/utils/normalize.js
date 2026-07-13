export const asId = (value) => String(value ?? '')

export const asNumber = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

export const uniqueById = (items = []) => {
  const map = new Map()
  items.forEach(item => {
    if (item?.id) map.set(asId(item.id), item)
  })
  return Array.from(map.values())
}

export const textIncludesAny = (value, variants = []) => {
  const text = String(value || '').toLowerCase()
  return variants.some(variant => text.includes(String(variant).toLowerCase()))
}

export const formatQty = (value) => new Intl.NumberFormat('uk-UA').format(asNumber(value))
