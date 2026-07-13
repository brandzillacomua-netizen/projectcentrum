import { asId, asNumber } from '../../utils/normalize.js'

export const countAsProduced = (card) => {
  return ['completed', 'at-shop2-buffer', 'at-buffer', 'waiting-buffer'].includes(card?.status)
}

export const isBufferCard = (card) => {
  const op = String(card?.operation || '').toLowerCase().replace(/\s+/g, ' ').trim()
  return op === 'склад бз'
    || op === 'склад bz'
    || op.includes('склад бз')
    || op.includes('склад bz')
    || op === 'сЃРєР»Р°Рґ Р±Р·'.toLowerCase()
    || op.includes('сЃРєР»Р°Рґ bz'.toLowerCase())
}

export const buildCardIndex = (cards = []) => {
  return new Map(cards.filter(Boolean).map(card => [asId(card.id), card]))
}

export const getHistoryScrapQty = (historyRow) => asNumber(historyRow?.scrap_qty)

export const buildScrapModel = (cards = [], historyRows = []) => {
  const cardById = buildCardIndex(cards)
  const cardScrap = {}
  const scrapByTask = {}
  const scrapRows = []

  historyRows.forEach(row => {
    const scrapQty = getHistoryScrapQty(row)
    if (scrapQty <= 0) return

    const card = row.card_id ? cardById.get(asId(row.card_id)) : null
    const taskId = asId(card?.task_id)
    const nomId = asId(row.nomenclature_id || card?.nomenclature_id)
    if (!taskId || !nomId) return

    cardScrap[asId(row.card_id)] = (cardScrap[asId(row.card_id)] || 0) + scrapQty
    if (!scrapByTask[taskId]) scrapByTask[taskId] = {}
    scrapByTask[taskId][nomId] = (scrapByTask[taskId][nomId] || 0) + scrapQty
    scrapRows.push({ ...row, scrapQty, card, taskId, nomId })
  })

  return { cardById, cardScrap, scrapByTask, scrapRows }
}

export const summarizeScrap = (scrapRows = [], nomenclatures = []) => {
  const byStage = {}
  const byOperator = {}
  const byNom = {}

  scrapRows.forEach(row => {
    const qty = asNumber(row.scrapQty || row.scrap_qty)
    const stage = row.stage_name || 'Не вказано'
    const operator = row.operator_name || 'Не вказано'
    const nom = nomenclatures.find(n => asId(n.id) === asId(row.nomId || row.nomenclature_id))
    const nomName = nom?.name || row.nomId || 'Невідома деталь'

    byStage[stage] = (byStage[stage] || 0) + qty
    byOperator[operator] = (byOperator[operator] || 0) + qty
    byNom[nomName] = (byNom[nomName] || 0) + qty
  })

  const total = scrapRows.reduce((sum, row) => sum + asNumber(row.scrapQty || row.scrap_qty), 0)
  return { total, byStage, byOperator, byNom }
}

export const getProducedQty = (cards = []) => {
  return cards
    .filter(countAsProduced)
    .reduce((sum, card) => sum + asNumber(card.quantity), 0)
}
