import { getCardSheets } from '../shortage/shortageCalculations.js'

const getRequestQty = (req) => Number(req?.qty) || Number(req?.quantity) || 0

const extractThickness = (str) => {
  const match = String(str || '').match(/(\d+(?:[.,]\d+)?)\s*мм/)
  return match ? parseFloat(match[1].replace(',', '.')) : null
}

const extractGrade = (str) => {
  const match = String(str || '').toLowerCase().match(/[tт]\s*(300|700)/)
  return match ? match[1] : null
}

/**
 * Calculates how many sheets of a part's current material have been issued by СО vs still pending,
 * and how many issued sheets remain available after accounting for already-generated cards.
 */
export const getKittingSheetsForPart = ({
  task,
  part,
  materialRequests = [],
  nomenclatures = [],
  workCards = []
}) => {
  const partNom = part?.nom || (nomenclatures || []).find(n => String(n.id) === String(part?.nomId))
  if (!task || !partNom) {
    return { issuedSheets: 0, pendingSheets: 0, usedByOtherPartsAcrossTask: 0, alreadyGeneratedSheets: 0, poolIssuedRemaining: 0, hasSheetReqs: false, hasKittingReqs: false }
  }

  const snapPart = (task?.plan_snapshot || {})[String(partNom?.id)] || {}
  const baseMat = part?.material || snapPart?.material || partNom?.material_type || ''
  const partName = part?.name || partNom?.name || snapPart?.name || ''
  const partCode = part?.code || partNom?.code || snapPart?.code || ''

  const taskReqs = (materialRequests || []).filter(r =>
    !r.card_id &&
    r.status !== 'cancelled' &&
    r.status !== 'rejected' &&
    (
      String(r.task_id) === String(task?.id) ||
      (r.order_id && task?.order_id && String(r.order_id) === String(task?.order_id))
    )
  )

  const baseThickness = extractThickness(baseMat)
  let baseGrade = extractGrade(baseMat)
  if (!baseGrade) {
    if (Number(snapPart?.sheets_t700) > 0 && !Number(snapPart?.sheets_t300)) {
      baseGrade = '700'
    } else if (Number(snapPart?.sheets_t300) > 0 && !Number(snapPart?.sheets_t700)) {
      baseGrade = '300'
    }
  }

  const matchesBaseMaterial = (candidate, reqObj) => {
    const candidateLower = String(candidate || '').toLowerCase()
    const candidateThickness = extractThickness(candidateLower)
    const candidateGrade = extractGrade(candidateLower)
    if (baseThickness !== null && candidateThickness !== null && baseThickness !== candidateThickness) return false
    if (baseGrade !== null && candidateGrade !== null && baseGrade !== candidateGrade) return false
    if (baseThickness !== null && candidateThickness !== null) return true

    if (reqObj?.details) {
      if (partName && reqObj.details.includes(partName)) return true
      if (partCode && reqObj.details.includes(partCode)) return true
    }

    const activeMaterials = baseMat.split('+').map(m => m.trim().toLowerCase()).filter(Boolean)
    return activeMaterials.some(act => candidateLower.includes(act) || act.includes(candidateLower))
  }

  const sheetReqs = taskReqs.filter(r => {
    const rNom = (nomenclatures || []).find(n => String(n.id) === String(r.nomenclature_id))
    const currentDetails = String(r.details || '').includes('→')
      ? String(r.details || '').split('→').pop()
      : (r.details || '')
    const rName = `${rNom?.name || ''} ${rNom?.material_type || ''} ${currentDetails}`
    const lowerName = rName.toLowerCase()
    const isSheet = lowerName.includes('лист') || lowerName.includes('sheet') || r.category === 'sheet'
    if (!isSheet) return false
    return matchesBaseMaterial(lowerName, r)
  })

  const issuedSheets = sheetReqs
    .filter(r => r.status === 'issued' || r.status === 'completed')
    .reduce((sum, r) => sum + getRequestQty(r), 0)
  const pendingSheets = sheetReqs
    .filter(r => r.status === 'pending')
    .reduce((sum, r) => sum + getRequestQty(r), 0)

  const usedByOtherPartsAcrossTask = (workCards || []).filter(card => {
    if (String(card.task_id) !== String(task?.id) || card.is_rework) return false
    if (String(card.nomenclature_id) === String(partNom?.id)) return false
    const operation = String(card.operation || '').toLowerCase()
    if (operation === 'склад бз' || operation.includes('склад bz')) return false
    const cardNom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
    const cardEntry = (task?.plan_snapshot || {})[String(card.nomenclature_id)]
    return matchesBaseMaterial(cardEntry?.material || cardNom?.material_type || cardNom?.name || '')
  }).reduce((sum, card) => {
    const cardNom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
    const cardEntry = (task?.plan_snapshot || {})[String(card.nomenclature_id)]
    const unitsPerSheet = Math.max(1, Number(cardNom?.units_per_sheet) || Number(cardEntry?.units_per_sheet) || 1)
    return sum + getCardSheets(card, unitsPerSheet)
  }, 0)

  const unitsPerSheet = Math.max(1, Number(part?.unitsPerSheet) || Number(partNom?.units_per_sheet) || 1)
  const partCards = part?.productionCards || (workCards || []).filter(c =>
    String(c.task_id) === String(task?.id) &&
    String(c.nomenclature_id) === String(partNom?.id) &&
    !c.is_rework
  )
  const alreadyGeneratedSheets = partCards.reduce((sum, c) => sum + getCardSheets(c, unitsPerSheet), 0)

  const poolIssuedRemaining = Math.max(0, issuedSheets - usedByOtherPartsAcrossTask - alreadyGeneratedSheets)
  const materialRequiresSheets = /(?:т|t)\s*(?:300|700)|лист|sheet/i.test(baseMat)

  return {
    issuedSheets,
    pendingSheets,
    usedByOtherPartsAcrossTask,
    alreadyGeneratedSheets,
    poolIssuedRemaining,
    hasSheetReqs: sheetReqs.length > 0,
    hasKittingReqs: materialRequiresSheets || sheetReqs.length > 0
  }
}

