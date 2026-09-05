export function normStr(str) {
  return str ? String(str).toLowerCase().replace(/[^a-z0-9а-яєіїґ]/g, '') : ''
}

/**
 * Determines whether a material request (sheet, cutter, etc.) belongs to a specific work card.
 * Handles multi-part tasks where different parts have different sheets and cutters.
 */
export function isRequestForCard(req, card, task = null, nomenclatures = []) {
  if (!req || !card) return false

  // 1. Direct card link
  if (req.card_id) {
    return String(req.card_id) === String(card.id)
  }

  // 2. Task-level match requirement
  if (req.task_id && card.task_id && String(req.task_id) !== String(card.task_id)) {
    return false
  }

  const reqDetailsNorm = normStr(req.details || '')

  // Find card nomenclature
  const nom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
  const nomNameNorm = normStr(nom?.name || '')

  // 3. Check if request details explicitly mentions this card's nomenclature name
  if (nomNameNorm && reqDetailsNorm.includes(nomNameNorm)) {
    return true
  }

  // 4. Check task.plan_snapshot.materialSummary for sheet requests
  const matSummary = task?.plan_snapshot?.materialSummary || {}
  for (const [, summary] of Object.entries(matSummary)) {
    if (
      String(summary?.nomenclature_id) === String(req.nomenclature_id) ||
      normStr(summary?.matName) === normStr(req.details)
    ) {
      const components = summary.components || []
      if (components.length > 0) {
        const matchesComponent = components.some(c => normStr(c).includes(nomNameNorm))
        if (matchesComponent) return true
        // If this sheet request has components list and none match this part,
        // it belongs to other parts in this task.
        return false
      }
    }
  }

  // 5. If request details explicitly mentions ANOTHER part in this task, it does NOT belong to this card
  if (task?.plan_snapshot) {
    const allTaskNomNames = Object.values(task.plan_snapshot)
      .filter(p => p && typeof p === 'object' && p.name)
      .map(p => normStr(p.name))
      .filter(name => name && name.length > 3)

    const mentionsOtherPart = allTaskNomNames.some(otherName =>
      otherName !== nomNameNorm && reqDetailsNorm.includes(otherName)
    )
    if (mentionsOtherPart) return false
  }

  // 6. Fallback: task-level request matches
  return true
}

/**
 * Returns all pending material/cutter requests specifically applicable to this card.
 */
export function getPendingRequestsForCard(card, requests = [], task = null, nomenclatures = []) {
  if (!card || !requests || requests.length === 0) return []
  return requests.filter(r => r && r.status === 'pending' && isRequestForCard(r, card, task, nomenclatures))
}
