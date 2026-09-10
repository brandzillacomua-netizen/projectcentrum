// Keep stored inventory names intact: legacy operations still use preparation tags.
export const getInventoryDisplayName = (item, nomenclatures = []) => {
  const originalName = item?.name || ''
  if (!item?.nomenclature_id || /непідготовлен/i.test(originalName)) return originalName

  const id = String(item.nomenclature_id)
  const sheet = nomenclatures.find(n =>
    n.group_id === 'grp_prepared_sheets' &&
    (String(n.id) === id || (n.legacy_ids || []).some(legacyId => String(legacyId) === id))
  )
  return sheet?.name || originalName
}
