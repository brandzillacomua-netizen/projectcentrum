const SGP_RECEIPT_STAGE = 'пакування/сгп'

const text = value => String(value || '').trim()

const rowTimestamp = row => row?.completed_at || row?.created_at || row?.started_at || null

export const isSgpReceiptHistory = row => {
  const stage = text(row?.stage_name).toLocaleLowerCase('uk-UA')
  const isPack = ['пакування/сгп', 'пакування', 'пакування', 'паковка', 'сгп'].some(s => stage.includes(s))
  return isPack && Number(row?.qty_completed) > 0
}

const inferSource = (history, card) => {
  const combined = `${text(history?.card_info)} ${text(card?.card_info)}`
  const shopMatch = combined.match(/\[ЦЕХ\s*№?\s*(\d+)\]/i)
  const shop = shopMatch ? `Цех №${shopMatch[1]}` : 'Виробництво'

  if (/ПРЯМА ПЕРЕДАЧА/i.test(combined) || /ПРЯМА ПЕРЕДАЧА/i.test(text(history?.operator_name))) {
    return `${shop} • пряма передача`
  }
  if (/ТЕРМІНАЛ/i.test(text(history?.operator_name))) {
    return `${shop} • термінал пакування`
  }
  return `${shop} • пакування`
}

export function buildSgpReceiptRegistry({
  history = [],
  workCards = [],
  tasks = [],
  orders = [],
  nomenclatures = []
} = {}) {
  const cardsById = new Map(workCards.map(card => [String(card.id), card]))
  const tasksById = new Map(tasks.map(task => [String(task.id), task]))
  const ordersById = new Map(orders.map(order => [String(order.id), order]))
  const nomsById = new Map()

  nomenclatures.forEach(nom => {
    nomsById.set(String(nom.id), nom)
    ;(nom.legacy_ids || []).forEach(id => {
      if (!nomsById.has(String(id))) nomsById.set(String(id), nom)
    })
  })

  const historyCardIds = new Set()

  const rowsFromHistory = history
    .filter(isSgpReceiptHistory)
    .map(receipt => {
      if (receipt.card_id) historyCardIds.add(String(receipt.card_id))
      const card = cardsById.get(String(receipt.card_id)) || {}
      const task = tasksById.get(String(card.task_id || receipt.task_id)) || {}
      const order = ordersById.get(String(card.order_id || task.order_id)) || {}
      const nomId = receipt.nomenclature_id || card.nomenclature_id
      const nom = nomsById.get(String(nomId)) || {}
      const timestamp = rowTimestamp(receipt)
      const cardInfo = text(receipt.card_info || card.card_info)
      const orderFromCard = cardInfo.match(/Наряд\s*№\s*([^\s\[]+)/i)?.[1] || ''

      return {
        id: receipt.id,
        timestamp,
        cardId: receipt.card_id || card.id,
        detailName: nom.name || card.nomenclature_name || 'Невідома деталь',
        detailCode: nom.code || '',
        quantity: Number(receipt.qty_completed || card.quantity) || 0,
        source: inferSource(receipt, card),
        orderNumber: order.order_num || order.number || orderFromCard.replace(/\/\d+$/, ''),
        batchIndex: task.batch_index || orderFromCard.match(/\/(\d+)$/)?.[1] || '',
        operatorName: receipt.operator_name || card.operator_name || 'Система'
      }
    })

  const rowsFromCompletedCards = workCards
    .filter(card => card && card.status === 'completed' && !historyCardIds.has(String(card.id)))
    .map(card => {
      const task = tasksById.get(String(card.task_id)) || {}
      const order = ordersById.get(String(card.order_id || task.order_id)) || {}
      const nom = nomsById.get(String(card.nomenclature_id)) || {}
      const cardInfo = text(card.card_info)
      const orderFromCard = cardInfo.match(/Наряд\s*№\s*([^\s\[]+)/i)?.[1] || ''

      return {
        id: `card-completed-${card.id}`,
        timestamp: card.completed_at || card.updated_at || card.created_at || null,
        cardId: card.id,
        detailName: nom.name || card.nomenclature_name || 'Невідома деталь',
        detailCode: nom.code || '',
        quantity: Number(card.quantity) || 0,
        source: inferSource(null, card),
        orderNumber: order.order_num || order.number || orderFromCard.replace(/\/\d+$/, ''),
        batchIndex: task.batch_index || orderFromCard.match(/\/(\d+)$/)?.[1] || '',
        operatorName: card.operator_name || 'Система'
      }
    })

  return [...rowsFromHistory, ...rowsFromCompletedCards]
    .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())
}

export function filterSgpReceiptRegistry(rows = [], query = '') {
  const normalized = text(query).toLocaleLowerCase('uk-UA')
  if (!normalized) return rows

  return rows.filter(row => [
    row.detailName,
    row.detailCode,
    row.source,
    row.orderNumber,
    row.cardId,
    row.operatorName
  ].some(value => text(value).toLocaleLowerCase('uk-UA').includes(normalized)))
}
