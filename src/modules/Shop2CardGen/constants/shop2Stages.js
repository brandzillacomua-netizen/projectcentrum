/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CENTRUM MES — Shop 2 Canonical Stages & Operations Matrix
 * ═══════════════════════════════════════════════════════════════════════════
 */

export const SHOP2_STAGE_KEYS = {
  PRESSING: 'pressing',
  PAINTING: 'painting',
  REWORK: 'rework',
  PACKAGING: 'packaging'
}

export const SHOP2_STAGES = [
  {
    key: SHOP2_STAGE_KEYS.PRESSING,
    name: 'Пресування',
    aliases: ['пресування', 'прес', 'pressing']
  },
  {
    key: SHOP2_STAGE_KEYS.PAINTING,
    name: 'Фарбування',
    aliases: ['фарбування', 'малярка', 'маляр', 'painting']
  },
  {
    key: SHOP2_STAGE_KEYS.REWORK,
    name: 'Доопрацювання',
    aliases: ['доопрацювання', 'доработка', 'rework']
  },
  {
    key: SHOP2_STAGE_KEYS.PACKAGING,
    name: 'Склад СГП (пряма передача)',
    aliases: ['пакування', 'паквання', 'пакван', 'паковка', 'сгп', 'packaging', 'sgp', 'склад сгп']
  }
]

export const SHOP2_STAGE_NAMES = SHOP2_STAGES.map(s => s.name)

/**
 * Check if an operation string belongs to Shop 2
 */
export function isShop2Operation(operationStr = '') {
  if (!operationStr) return false
  const clean = String(operationStr).toLowerCase().trim()
  return SHOP2_STAGES.some(stage => 
    stage.aliases.some(alias => clean.includes(alias))
  )
}

/**
 * Check if an operation corresponds to Packaging / SGP final yield
 */
export function isPackagingOperation(operationStr = '') {
  if (!operationStr) return false
  const clean = String(operationStr).toLowerCase().trim()
  const packStage = SHOP2_STAGES.find(s => s.key === SHOP2_STAGE_KEYS.PACKAGING)
  return Boolean(packStage?.aliases.some(alias => clean.includes(alias)))
}

/**
 * Check if a work card was created for / belongs to Shop 2 (and must be hidden from Shop 1 views)
 */
export function isShop2OwnedCard(card, shop2TaskIdsSet = new Set()) {
  if (!card) return false
  if (shop2TaskIdsSet.has(String(card.task_id || ''))) return true
  const info = String(card.card_info || '')
  if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
  if (card.status !== 'at-shop2-buffer' && isShop2Operation(card.operation)) return true
  return false
}

/**
 * Resolve canonical stage key for an operation
 */
export function getCanonicalShop2Stage(operationStr = '') {
  if (!operationStr) return null
  const clean = String(operationStr).toLowerCase().trim()
  const found = SHOP2_STAGES.find(stage => 
    stage.aliases.some(alias => clean.includes(alias))
  )
  return found || null
}
