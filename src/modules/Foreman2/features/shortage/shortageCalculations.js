import { asId, asNumber } from '../../utils/normalize.js'
import { countAsProduced, getProducedQty, isBufferCard } from '../scrap/scrapCalculations.js'
import { getSnapshotPartEntries } from '../task-loading/taskSelectors.js'
import { getBestKnownProducedFromFlow } from './flowUtils.js'

export const getCardSheets = (card, unitsPerSheet, cardScrap = 0) => {
  const explicit = asNumber(card?.actual_sheets || card?.actualSheets)
  if (explicit > 0) return explicit
  const originalQty = asNumber(card?.quantity) + asNumber(cardScrap)
  return Math.ceil(originalQty / Math.max(1, asNumber(unitsPerSheet, 1)))
}

export const calculatePartShortage = ({ task, entry, cards, cardScrapMap, scrapByNom, flowTotalsByTaskNom = {} }) => {
  const nomId = asId(entry.nomId)
  const snapshot = entry.snapshot || {}
  const unitsPerSheet = Math.max(1, asNumber(snapshot.units_per_sheet || entry.nom?.units_per_sheet, 1))
  const need = asNumber(snapshot.need)
  const stockBZ = asNumber(snapshot.stock)
  const plan = asNumber(snapshot.plan, Math.max(0, need - stockBZ))
  const plannedSheets = asNumber(snapshot.sheets)

  const nomCards = cards.filter(card => asId(card.task_id) === asId(task.id) && asId(card.nomenclature_id) === nomId)
  const productionCards = nomCards.filter(card => !isBufferCard(card))
  
  const flowRows = flowTotalsByTaskNom?.[asId(task.id)]?.[nomId] || []
  
  // Filter flow rows to only include active cards to avoid summing deleted cards
  const activeCardIds = new Set(nomCards.map(c => String(c.id)))
  const activeFlowRows = flowRows.filter(row => activeCardIds.has(String(row.card_id)))
  
  const flowProduced = activeFlowRows.length > 0 ? getBestKnownProducedFromFlow(activeFlowRows) : 0
  const sumProduced = getProducedQty(nomCards)
  const produced = flowProduced > 0 ? flowProduced : sumProduced

  const activeRedo = nomCards.some(card => {
    const info = String(card.card_info || '')
    return !countAsProduced(card) && (card.is_rework || info.includes('[REDO]'))
  })

  const actualSheets = productionCards.reduce((sum, card) => {
    return sum + getCardSheets(card, unitsPerSheet, cardScrapMap[asId(card.id)] || 0)
  }, 0)

  const totalSheets = productionCards.length > 0 ? Math.max(plannedSheets, actualSheets) : plannedSheets
  const spareFromSheets = (totalSheets * unitsPerSheet) + stockBZ - need
  const scrap = asNumber(scrapByNom?.[nomId])
  const shortage = Math.max(0, scrap - spareFromSheets)

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
    spareFromSheets,
    shortage,
    activeRedo,
    cards: nomCards,
    productionCards,
    machine: snapshot.machine || snapshot.selected_machine || task.machine_name || productionCards[0]?.machine || '',
    splits,
    isSplitMode
  }
}

export const calculateTaskParts = ({ task, cards, scrapModel, nomenclatures, flowTotalsByTaskNom = {} }) => {
  const entries = getSnapshotPartEntries(task, nomenclatures)
  const taskScrap = scrapModel.scrapByTask?.[asId(task.id)] || {}

  return entries.map(entry => calculatePartShortage({
    task,
    entry,
    cards,
    cardScrapMap: scrapModel.cardScrap || {},
    scrapByNom: taskScrap,
    flowTotalsByTaskNom
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
