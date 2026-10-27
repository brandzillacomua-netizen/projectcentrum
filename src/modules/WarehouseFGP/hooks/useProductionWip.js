import { useMemo, useCallback } from 'react'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers.js'
import { normalizeKey } from '../warehouseFgpInventory.js'

export const WIP_STAGES = {
  CNC: 'cnc',
  TUMBLING: 'tumbling',
  SORTING: 'sorting',
  SHOP2: 'shop2'
}

export function classifyWorkCardStage(card, shop2TaskIdsSet = new Set()) {
  if (!card) return { stage: WIP_STAGES.CNC, stageName: 'Розкрій', subStage: 'Невідомо' }

  const status = String(card.status || '').toLowerCase()
  const op = String(card.operation || '').trim()
  const opLower = op.toLowerCase()
  const info = String(card.card_info || '')

  // 1. Shop 2 (Цех 2, пресування, малярка, доопрацювання, буфер цеху 2)
  if (
    status === 'at-shop2-buffer' ||
    shop2TaskIdsSet.has(String(card.task_id)) ||
    info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]') ||
    ['пресування', 'фарбування', 'малярка', 'доопрацювання'].includes(opLower) ||
    opLower.includes('цех 2') || opLower.includes('цех №2')
  ) {
    return {
      stage: WIP_STAGES.SHOP2,
      stageName: 'Цех 2',
      subStage: status === 'at-shop2-buffer' ? 'Буфер Цеху 2' : (op || 'Цех 2')
    }
  }

  // 2. Sorting / Acceptance (Сортування, Прийомка, ВКЯ)
  if (
    status === 'at-sorting-buffer' ||
    status === 'sorting' ||
    op === 'Сортування' ||
    op === 'Прийомка' ||
    op === 'ВКЯ' ||
    opLower.includes('сортування') ||
    opLower.includes('прийомка') ||
    (status === 'at-buffer' && (op === 'Прийомка' || op === 'Сортування'))
  ) {
    return {
      stage: WIP_STAGES.SORTING,
      stageName: 'Сортування',
      subStage: (status === 'at-buffer' || status === 'at-sorting-buffer') ? 'Буфер сортування' : (op || 'Сортування')
    }
  }

  // 3. Tumbling (Галтовка, вібростіл, мийка, галтовка, сушка)
  if (
    opLower.startsWith('галтовка') ||
    status === 'at-tumbling-buffer' ||
    status === 'tumbling' ||
    (status === 'at-buffer' && (op === 'Розкрій' || opLower.startsWith('галтовка')))
  ) {
    return {
      stage: WIP_STAGES.TUMBLING,
      stageName: 'Галтовка',
      subStage: status.includes('buffer') || status === 'at-buffer' ? 'Буфер галтовки' : (op || 'Галтовка')
    }
  }

  // 4. Cutting (Розкрій, ЧПК, Нова)
  return {
    stage: WIP_STAGES.CNC,
    stageName: 'Розкрій',
    subStage: status === 'at-buffer' ? 'Буфер розкрою' : (op || 'Розкрій')
  }
}

export function useProductionWip({
  workCards = [],
  tasks = [],
  orders = [],
  nomenclatures = [],
  searchQuery = ''
}) {
  // Extract Shop 2 task IDs for stage detection
  const shop2TaskIdsSet = useMemo(() => {
    const set = new Set()
    ;(tasks || []).forEach(t => {
      const step = String(t.step || '').toLowerCase()
      const name = String(t.name || '').toLowerCase()
      if (
        step.includes('цех №2') || step.includes('цех 2') || step.includes('пресування') || step.includes('фарбування') || step.includes('маляр') ||
        name.includes('цех №2') || name.includes('цех 2') || name.includes('пресування') || name.includes('фарбування') || name.includes('маляр')
      ) {
        set.add(String(t.id))
      }
    })
    return set
  }, [tasks])

  // Filter only active, in-progress work cards (exclude completed, cancelled, deleted, scrap)
  const activeWipCards = useMemo(() => {
    return (workCards || []).filter(c => {
      if (!c) return false
      const status = String(c.status || '').toLowerCase()
      if (status === 'completed' || status === 'cancelled' || status === 'deleted' || status === 'scrap') {
        return false
      }
      const op = String(c.operation || '').toLowerCase()
      if (op === 'склад бз' || op.includes('пакування/сгп') || op === 'сгп') {
        return false
      }
      const qty = Number(c.quantity || 0)
      return qty > 0
    })
  }, [workCards])

  // Group active WIP cards by nomenclature
  const { groupedWipItems, totals } = useMemo(() => {
    const map = new Map()
    const stageTotals = {
      totalWip: 0,
      cnc: 0,
      tumbling: 0,
      sorting: 0,
      shop2: 0,
      cardsCount: 0
    }

    activeWipCards.forEach(card => {
      const qty = Number(card.quantity || 0)
      const stageInfo = classifyWorkCardStage(card, shop2TaskIdsSet)

      // Find nomenclature details
      const rawNomId = card.nomenclature_id
      const canonicalNomId = rawNomId ? resolveCanonicalNomId(rawNomId, nomenclatures) : null
      const matchedNom = canonicalNomId
        ? nomenclatures.find(n => String(n.id) === String(canonicalNomId))
        : null

      const name = (matchedNom?.name || card.nomenclature_name || card.card_info || 'Деталь').trim()
      const code = matchedNom?.code || matchedNom?.article || '—'
      const normName = normalizeKey(name)
      const groupKey = canonicalNomId ? `nom_${canonicalNomId}` : `name_${normName}`

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          key: groupKey,
          nomenclature_id: canonicalNomId || rawNomId,
          name,
          code,
          unit: matchedNom?.unit || card.unit || 'шт',
          totalWip: 0,
          cncQty: 0,
          tumblingQty: 0,
          sortingQty: 0,
          shop2Qty: 0,
          cards: [],
          orderNumbers: new Set()
        })
      }

      const row = map.get(groupKey)
      row.totalWip += qty

      if (stageInfo.stage === WIP_STAGES.CNC) {
        row.cncQty += qty
        stageTotals.cnc += qty
      } else if (stageInfo.stage === WIP_STAGES.TUMBLING) {
        row.tumblingQty += qty
        stageTotals.tumbling += qty
      } else if (stageInfo.stage === WIP_STAGES.SORTING) {
        row.sortingQty += qty
        stageTotals.sorting += qty
      } else if (stageInfo.stage === WIP_STAGES.SHOP2) {
        row.shop2Qty += qty
        stageTotals.shop2 += qty
      }

      stageTotals.totalWip += qty
      stageTotals.cardsCount += 1

      // Find order / task info for this card
      const taskObj = (tasks || []).find(t => String(t.id) === String(card.task_id))
      const orderObj = (orders || []).find(o => String(o.id) === String(card.order_id || taskObj?.order_id))
      const rawOrderNum = orderObj?.order_num || taskObj?.order_num || card.card_info?.match(/Наряд №?(\d+(?:-\d+)?)/i)?.[1]
      const orderNumStr = rawOrderNum ? (String(rawOrderNum).startsWith('№') ? String(rawOrderNum) : `№${rawOrderNum}`) : null
      if (orderNumStr) {
        row.orderNumbers.add(orderNumStr)
      }

      row.cards.push({
        ...card,
        stage: stageInfo.stage,
        stageName: stageInfo.stageName,
        subStage: stageInfo.subStage,
        orderNumber: orderNumStr,
        taskName: taskObj?.name || taskObj?.step || 'Завдання'
      })
    })

    const items = Array.from(map.values())
      .map(row => ({
        ...row,
        ordersList: Array.from(row.orderNumbers).sort()
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'))

    return { groupedWipItems: items, totals: stageTotals }
  }, [activeWipCards, nomenclatures, tasks, orders, shop2TaskIdsSet])

  // Filter by user search query
  const filteredWipItems = useMemo(() => {
    if (!searchQuery.trim()) return groupedWipItems
    const q = searchQuery.toLowerCase().trim()
    return groupedWipItems.filter(item => {
      const matchName = item.name.toLowerCase().includes(q)
      const matchCode = (item.code || '').toLowerCase().includes(q)
      const matchOrder = (item.ordersList || []).some(o => o.toLowerCase().includes(q))
      return matchName || matchCode || matchOrder
    })
  }, [groupedWipItems, searchQuery])

  return {
    groupedWipItems,
    filteredWipItems,
    totalWipParts: totals.totalWip,
    wipStageTotals: totals,
    activeWipCardsCount: totals.cardsCount
  }
}
