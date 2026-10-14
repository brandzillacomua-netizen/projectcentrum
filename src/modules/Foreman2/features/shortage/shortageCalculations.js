import { asId, asNumber } from '../../utils/normalize.js'
import { countAsProduced, getProducedQty, isBufferCard } from '../scrap/scrapCalculations.js'
import { getSnapshotPartEntries } from '../task-loading/taskSelectors.js'
import { getBestKnownProducedFromFlow } from './flowUtils.js'

export const capacityByMachine = (machineName) => {
  const text = String(machineName || '').toLowerCase()
  if (text.includes('1200') || text.includes('12x8') || text.includes('мал')) return 6
  if (text.includes('3050') || text.includes('16x16')) return 12
  if (text.includes('3060') || text.includes('30x16')) return 36
  if (text.includes('6000') || text.includes('60x20')) return 96
  if (text.includes('ke xin')) return 16
  return 1
}

export const capacityRangeByMachine = (machineName) => {
  const maxCapacity = Math.max(1, capacityByMachine(machineName))
  const text = String(machineName || '').toLowerCase()
  const isVariableSmallMachine = text.includes('1200') || text.includes('12x8') || text.includes('мал')
  return {
    defaultCapacity: isVariableSmallMachine ? 1 : maxCapacity,
    maxCapacity
  }
}

export const isVkyaReturnCard = (card) => {
  // A cutting card ('Розкрій') was cut from sheet metal and is not a standalone VKYA return card
  if (card?.operation === 'Розкрій') return false
  const info = String(card?.card_info || '')
  // Standalone VKYA return cards represent already manufactured details coming
  // back to the route. Colon-form tags are audit notes appended to an original
  // cutting card, so they must not turn that original card into a zero-sheet card.
  return /\[(?:VKYA[\s_]+RETURN|VKYA[\s_]+RESTORED[\s_]+RETURN|VKYA[\s_]+RETURNED[\s_]+TO[\s_]+ROUTE)\]/i.test(info)
}

export const isZeroSheetCard = (card) => isBufferCard(card) || isVkyaReturnCard(card)

export const getCardSheets = (card, unitsPerSheet, fallbackCapacity = null) => {
  if (isZeroSheetCard(card)) return 0

  const explicit = asNumber(card?.actual_sheets ?? card?.actualSheets ?? card?.sheets)
  if (explicit > 0) return explicit
  if (card?.card_info) {
    const info = String(card.card_info)
    const sheetsMatch = info.match(/\[SHEETS:(\d+)\]/i)
    if (sheetsMatch && asNumber(sheetsMatch[1]) > 0) return asNumber(sheetsMatch[1])

    const reqMatch = info.match(/\[REQ:(\d+)\]/i)
    const bzMatch = info.match(/\[BZ:(\d+)\]/i)
    if (reqMatch || bzMatch) {
      // REQ is only the order demand. BZ is the usable remainder cut from the
      // same loading, so both quantities are required to reconstruct sheets.
      const loadedQty = asNumber(reqMatch?.[1]) + asNumber(bzMatch?.[1])
      if (loadedQty > 0) {
        return Math.ceil(loadedQty / Math.max(1, asNumber(unitsPerSheet, 1)))
      }
    }
  }
  // Fall back to quantity + scrap_qty_from_history
  const scrapQty = asNumber(card?.scrap_qty_from_history ?? card?.scrap_qty ?? 0)
  const targetQty = asNumber(card?.quantity) + scrapQty
  if (targetQty > 0) {
    return Math.ceil(targetQty / Math.max(1, asNumber(unitsPerSheet, 1)))
  }

  // If card was completed or scrapped down to 0 quantity, check qty_at_start
  const startQty = asNumber(card?.qty_at_start ?? card?.initial_qty)
  if (startQty > 0) {
    return Math.ceil(startQty / Math.max(1, asNumber(unitsPerSheet, 1)))
  }

  // If fallback capacity is provided or derivable from machine, use it
  if (fallbackCapacity && fallbackCapacity > 0) {
    return fallbackCapacity
  }
  const machineCap = capacityRangeByMachine(card?.machine).defaultCapacity
  if (machineCap > 1) {
    return machineCap
  }

  // For any genuine cutting card created for this part, at least 1 sheet was used
  return 1
}

export const calculatePartShortage = ({
  task,
  entry,
  cards,
  cardScrapMap,
  scrapByNom,
  pendingVkyaByNom = {},
  qualityHoldCardsByNom = {},
  flowTotalsByTaskNom = {},
  finalScrapByTask = {},
  vkyaReturnedByTask = {},
  hasFinalScrapProjection = false
}) => {
  const nomId = asId(entry.nomId)
  const snapshot = entry.snapshot || {}
  const liveUnitsPerSheet = asNumber(entry.nom?.units_per_sheet || entry.nom?.unitsPerSheet || entry.nom?.rule_params?.unitsPerSheet)
  const unitsPerSheet = Math.max(1, liveUnitsPerSheet || asNumber(snapshot.units_per_sheet, 1))
  const need = asNumber(snapshot.need)
  const stockBZ = asNumber(snapshot.stock)
  const plan = asNumber(snapshot.plan, Math.max(0, need - stockBZ))
  const plannedSheets = Math.ceil(plan / unitsPerSheet)

  const parseCardSeqNumber = (card) => {
    if (card?.card_sequence !== undefined && card?.card_sequence !== null && !isNaN(Number(card.card_sequence))) {
      return Number(card.card_sequence)
    }
    const info = String(card?.card_info || '')
      .replace(/Наряд\s*№\s*\S+/gi, '')
      .replace(/ЦЕХ\s*№\s*\d+/gi, '')
      .replace(/Цех\s*№\s*\d+/gi, '')
    const match = info.match(/(?:№|#)?\s*(\d+)(?:\/(\d+))?/)
    return match ? parseInt(match[1], 10) : 999999
  }

  const getScrapFromMap = (entry) => {
    if (entry && typeof entry === 'object') {
      return asNumber(entry.scrap ?? entry.util ?? 0)
    }
    return asNumber(entry, 0)
  }

  const nomCards = cards
    .filter(card => asId(card.task_id) === asId(task.id) && asId(card.nomenclature_id) === nomId)
    .sort((a, b) => parseCardSeqNumber(a) - parseCardSeqNumber(b))
    .map(card => ({
      ...card,
      scrap_qty_from_history: getScrapFromMap(cardScrapMap?.[asId(card.id)])
    }))
  const productionCards = nomCards.filter(card => !isBufferCard(card))
  
  const flowRows = flowTotalsByTaskNom?.[asId(task.id)]?.[nomId] || []
  
  const flowProduced = flowRows.length > 0 ? getBestKnownProducedFromFlow(flowRows) : 0
  const sumProduced = getProducedQty(nomCards)
  const produced = flowProduced > 0 ? flowProduced : sumProduced

  const isRedoCard = (card) => {
    const info = String(card.card_info || '')
    return card.is_rework || info.includes('[REDO]') || info.includes('[REPAIR]')
  }

  const activeRedo = nomCards.some(card => !countAsProduced(card) && isRedoCard(card))

  // Already-issued reissue (dovypusk) quantities
  const redoQty = nomCards
    .filter(card => countAsProduced(card) && isRedoCard(card))
    .reduce((sum, card) => sum + asNumber(card.quantity), 0)
  const redoPendingQty = nomCards
    .filter(card => !countAsProduced(card) && isRedoCard(card))
    .reduce((sum, card) => sum + asNumber(card.quantity), 0)

  let maxSeqTotal = 0
  nomCards.forEach(c => {
    const info = String(c?.card_info || '')
    const match = info.match(/(?:№|#)?\s*\d+\s*\/\s*(\d+)/)
    if (match) {
      const tot = parseInt(match[1], 10)
      if (tot > maxSeqTotal) maxSeqTotal = tot
    }
  })

  const defaultMachineCap = capacityRangeByMachine(
    snapshot.machine || snapshot.selected_machine || task.machine_name || productionCards[0]?.machine || ''
  ).defaultCapacity

  const knownSheetsList = productionCards
    .map(c => getCardSheets(c, unitsPerSheet, null))
    .filter(s => s > 0)
  
  const inferredCardSheets = (maxSeqTotal > 0 && plannedSheets > 0)
    ? Math.max(1, Math.round(plannedSheets / maxSeqTotal))
    : (knownSheetsList.length > 0 ? knownSheetsList[0] : (defaultMachineCap > 0 ? defaultMachineCap : 1))

  const rawActualSheets = productionCards.reduce((sum, card) => {
    return sum + getCardSheets(card, unitsPerSheet, inferredCardSheets)
  }, 0)

  // Sheets count is cumulative: once a batch of cutting cards is generated, those sheets
  // have been consumed from raw material stock and can never decrease due to completion,
  // scrap, or routing changes. If the full quota of cards/loads was generated, actualSheets
  // must stay at least plannedSheets permanently.
  const expectedPlannedCards = maxSeqTotal > 0
    ? maxSeqTotal
    : ((plannedSheets > 0 && defaultMachineCap > 0) ? Math.ceil(plannedSheets / defaultMachineCap) : 0)

  const hasFullCardCount = expectedPlannedCards > 0 && productionCards.length >= expectedPlannedCards
  const actualSheets = hasFullCardCount
    ? Math.max(plannedSheets, rawActualSheets)
    : rawActualSheets

  const totalSheets = productionCards.length > 0 ? Math.max(plannedSheets, actualSheets) : plannedSheets
  const spareFromSheets = (totalSheets * unitsPerSheet) + stockBZ - need
  const observedScrapRaw = asNumber(scrapByNom?.[nomId])
  const scrapFromCards = nomCards.reduce((sum, card) => {
    return sum + (asNumber(cardScrapMap?.[asId(card.id)]?.util) || 0)
  }, 0)
  const projectionScrap = asNumber(finalScrapByTask?.[asId(task.id)]?.[nomId])
  const scrap = hasFinalScrapProjection
    ? Math.max(projectionScrap, scrapFromCards)
    : Math.max(observedScrapRaw, scrapFromCards)
  const shortage = scrap > 0 ? Math.max(0, scrap - Math.max(0, spareFromSheets)) : 0

  const returnedFromCardInfo = nomCards.reduce((sum, card) => {
    const info = String(card.card_info || '')
    const match = info.match(/\[VKYA_(?:RESTORED_)?RETURN:[^:]+:(\d+)\]/)
    if (match) return sum + (Number(match[1]) || 0)
    return sum
  }, 0)
  const returnedFromResolutionIndex = asNumber(vkyaReturnedByTask?.[asId(task.id)]?.[nomId])
  const returnedVkya = Math.max(returnedFromResolutionIndex, returnedFromCardInfo)

  // Quality Hold (НА ВКЯ): parts sent to VKYA that have neither been written off as Cat4 Util (scrap) nor returned to order (returnedVkya)
  const qualityHoldFromCards = asNumber(qualityHoldCardsByNom?.[nomId])
  const qualityHoldFromPending = asNumber(pendingVkyaByNom?.[nomId])
  const qualityHoldFromFormula = Math.max(0, observedScrapRaw - scrap - returnedVkya)
  const qualityHold = Math.max(qualityHoldFromCards, qualityHoldFromPending, qualityHoldFromFormula)

  // Overall Total Scrap MUST BE at least (scrap + qualityHold + returnedVkya) so overallScrap is never smaller than scrap (util)
  const observedScrap = Math.max(observedScrapRaw, scrap + qualityHold + returnedVkya)

  const splits = Array.isArray(snapshot.splits) ? snapshot.splits : []
  const isSplitMode = splits.length > 0

  return {
    taskId: asId(task.id),
    nomId,
    nom: entry.nom,
    name: entry.name,
    need,
    stockBZ,
    plan,
    material: snapshot.material || snapshot.material_name || snapshot.sheet || snapshot.sheet_name || entry.nom?.material || '',
    code: entry.nom?.nomenclature_code || snapshot.code || '',
    unitsPerSheet,
    plannedSheets,
    actualSheets,
    totalSheets,
    produced,
    scrap,
    observedScrap,
    qualityHold,
    returnedVkya,
    spareFromSheets,
    shortage,
    activeRedo,
    redoQty,
    redoPendingQty,
    cards: nomCards,
    productionCards,
    machine: snapshot.machine || snapshot.selected_machine || task.machine_name || productionCards[0]?.machine || '',
    splits,
    isSplitMode
  }
}

export const calculateTaskParts = ({
  task,
  cards,
  scrapModel,
  nomenclatures,
  flowTotalsByTaskNom = {},
  finalScrapByTask = {},
  vkyaReturnedByTask = {},
  hasFinalScrapProjection = false
}) => {
  const entries = getSnapshotPartEntries(task, nomenclatures)
  const taskId = asId(task.id)
  const taskScrap = scrapModel.scrapByTask?.[taskId] || {}
  const pendingVkyaByNom = scrapModel.pendingVkyaByTask?.[taskId] || {}
  const qualityHoldCardsByNom = scrapModel.qualityHoldCardsByTask?.[taskId] || {}

  return entries.map(entry => calculatePartShortage({
    task,
    entry,
    cards,
    cardScrapMap: scrapModel.cardScrap || {},
    scrapByNom: taskScrap,
    pendingVkyaByNom,
    qualityHoldCardsByNom,
    flowTotalsByTaskNom,
    finalScrapByTask,
    vkyaReturnedByTask,
    hasFinalScrapProjection
  }))
}

export const summarizeTaskState = ({ task, cards, parts }) => {
  const taskCards = cards.filter(card => asId(card.task_id) === asId(task.id))
  const hasShortage = parts.some(part => part.shortage > 0)
  const isReady = task.status !== 'completed'
    && parts.length > 0
    && parts.every(part => part.need <= 0 || part.produced >= part.need)
    && !taskCards.some(card => !countAsProduced(card))

  return {
    totalCards: taskCards.filter(card => !isBufferCard(card)).length,
    totalProduced: parts.reduce((sum, part) => sum + part.produced, 0),
    totalScrap: parts.reduce((sum, part) => sum + part.scrap, 0),
    totalShortage: parts.reduce((sum, part) => sum + part.shortage, 0),
    hasShortage,
    isReady,
    taskCards
  }
}
