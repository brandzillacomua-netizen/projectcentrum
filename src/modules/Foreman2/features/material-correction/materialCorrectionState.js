const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, '')

export function getPendingMaterialCorrection({ requests = [], taskId, partId, snapshot, nomenclatures = [] }) {
  const currentMaterial = normalize(snapshot?.material)

  return requests.find(request => {
    if (String(request.task_id) !== String(taskId) || request.status !== 'pending') return false
    const details = String(request.details || '')
    const explicitPartMarker = details.includes(`[MATERIAL_CORRECTION:${partId}]`)
    if (explicitPartMarker) return true
    if (!details.includes('ВИПРАВЛЕНО В НАРЯДІ')) return false

    const requestNom = nomenclatures.find(nom => String(nom.id) === String(request.nomenclature_id))
    const requestMaterial = normalize(`${requestNom?.name || ''} ${requestNom?.material_type || ''}`)
    return Boolean(currentMaterial) && (
      requestMaterial.includes(currentMaterial) ||
      currentMaterial.includes(normalize(requestNom?.name))
    )
  }) || null
}
