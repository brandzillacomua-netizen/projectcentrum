import { useMemo, useCallback } from 'react'

export function useShop2Buffer({ tasks, workCards, orders, nomenclatures, searchQuery = '' }) {
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

  const isShop2Card = useCallback((card) => {
    if (!card) return false
    if (shop2TaskIdsSet.has(String(card.task_id))) return true
    const info = String(card.card_info || '')
    if (info.includes('[SHOP:2]') || info.includes('[ЦЕХ №2]') || info.includes('[ЦЕХ 2]')) return true
    const op = String(card.operation || '')
    if (['Пресування', 'Фарбування', 'Малярка', 'Доопрацювання', 'Пакування'].includes(op)) return true
    return false
  }, [shop2TaskIdsSet])

  const shop2BufferCards = useMemo(() => {
    return (workCards || []).filter(c => {
      if (isShop2Card(c)) return false
      const status = String(c.status || '')
      return status === 'at-shop2-buffer'
    })
  }, [workCards, isShop2Card])

  const totalShop2BufferParts = useMemo(() => {
    let sum = 0
    shop2BufferCards.forEach(card => {
      const qty = Number(card.quantity || 0)
      const used = Number(card.used_in_shop2_qty || 0)
      sum += Math.max(0, qty - used)
    })
    return sum
  }, [shop2BufferCards])

  const shop2BufferTaskGroups = useMemo(() => {
    const groups = {}
    shop2BufferCards.forEach(card => {
      const qty = Number(card.quantity || 0)
      const used = Number(card.used_in_shop2_qty || 0)
      const avail = Math.max(0, qty - used)
      if (avail <= 0) return

      const taskId = card.task_id || 'unassigned'
      if (!groups[taskId]) {
        const taskObj = (tasks || []).find(t => String(t.id) === String(taskId))
        const orderObj = (orders || []).find(o => String(o.id) === String(card.order_id || taskObj?.order_id))
        const rawNum = orderObj?.order_num || taskObj?.order_num || card.card_info?.match(/Наряд №(\d+(?:-\d+)?)/)?.[1] || 'Вільний запас'
        const orderNumStr = String(rawNum)
        const displayNum = orderNumStr.startsWith('№') || orderNumStr.includes('Вільний') || orderNumStr.includes('Загальний')
          ? orderNumStr
          : `Наряд №${orderNumStr}`

        groups[taskId] = {
          taskId,
          orderNum: displayNum,
          orderId: card.order_id || taskObj?.order_id,
          items: {},
          totalQty: 0,
          totalCards: 0
        }
      }

      const nomId = card.nomenclature_id || card.card_info || 'unknown'
      if (!groups[taskId].items[nomId]) {
        const nom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
        groups[taskId].items[nomId] = {
          nomId,
          name: nom?.name || card.nomenclature_name || card.card_info || 'Деталь',
          unit: nom?.unit || 'шт',
          material: nom?.material_type || nom?.material || card.material || '—',
          thickness: nom?.thickness || card.thickness || '',
          total_qty: 0,
          cardCount: 0
        }
      }
      groups[taskId].items[nomId].total_qty += avail
      groups[taskId].items[nomId].cardCount += 1
      groups[taskId].totalQty += avail
      groups[taskId].totalCards += 1
    })

    return Object.values(groups).filter(g => g.totalQty > 0)
  }, [shop2BufferCards, tasks, orders, nomenclatures])

  const filteredShop2BufferTaskGroups = useMemo(() => {
    if (!searchQuery.trim()) return shop2BufferTaskGroups
    const q = searchQuery.toLowerCase().trim()
    return shop2BufferTaskGroups.map(group => {
      const matchOrder = (group.orderNum || '').toLowerCase().includes(q)
      if (matchOrder) return group
      const filteredItems = {}
      Object.entries(group.items).forEach(([k, item]) => {
        if (
          (item.name || '').toLowerCase().includes(q) ||
          (item.material || '').toLowerCase().includes(q)
        ) {
          filteredItems[k] = item
        }
      })
      if (Object.keys(filteredItems).length === 0) return null
      const totalFilteredQty = Object.values(filteredItems).reduce((sum, it) => sum + it.total_qty, 0)
      const totalFilteredCards = Object.values(filteredItems).reduce((sum, it) => sum + it.cardCount, 0)
      return {
        ...group,
        items: filteredItems,
        totalQty: totalFilteredQty,
        totalCards: totalFilteredCards
      }
    }).filter(Boolean)
  }, [shop2BufferTaskGroups, searchQuery])

  const shop2BufferConsolidatedItems = useMemo(() => {
    const map = new Map()
    shop2BufferCards.forEach(card => {
      const qty = Number(card.quantity || 0)
      const used = Number(card.used_in_shop2_qty || 0)
      const avail = Math.max(0, qty - used)
      if (avail <= 0) return

      const nom = (nomenclatures || []).find(n => String(n.id) === String(card.nomenclature_id))
      const name = nom?.name || card.nomenclature_name || card.card_info || 'Деталь'
      const key = (nom?.id ? `nom-${nom.id}` : name).toLowerCase()

      const taskObj = (tasks || []).find(t => String(t.id) === String(card.task_id))
      const orderObj = (orders || []).find(o => String(o.id) === String(card.order_id || taskObj?.order_id))
      const rawNum = orderObj?.order_num || taskObj?.order_num || card.card_info?.match(/Наряд №(\d+(?:-\d+)?)/)?.[1] || 'Вільний'
      const naryadBadge = String(rawNum).startsWith('№') ? rawNum : `№${rawNum}`

      if (!map.has(key)) {
        map.set(key, {
          key,
          nomId: nom?.id || card.nomenclature_id,
          name,
          unit: nom?.unit || 'шт',
          material: nom?.material_type || nom?.material || card.material || '—',
          thickness: nom?.thickness || card.thickness || '',
          total_qty: 0,
          cardCount: 0,
          naryads: new Set()
        })
      }

      const item = map.get(key)
      item.total_qty += avail
      item.cardCount += 1
      item.naryads.add(naryadBadge)
    })

    const list = Array.from(map.values()).map(item => ({
      ...item,
      naryadList: Array.from(item.naryads)
    })).sort((a, b) => b.total_qty - a.total_qty)

    if (!searchQuery.trim()) return list
    const q = searchQuery.toLowerCase().trim()
    return list.filter(item =>
      (item.name || '').toLowerCase().includes(q) ||
      (item.material || '').toLowerCase().includes(q) ||
      item.naryadList.some(nr => nr.toLowerCase().includes(q))
    )
  }, [shop2BufferCards, nomenclatures, tasks, orders, searchQuery])

  return {
    shop2BufferCards,
    totalShop2BufferParts,
    shop2BufferTaskGroups,
    filteredShop2BufferTaskGroups,
    shop2BufferConsolidatedItems
  }
}
