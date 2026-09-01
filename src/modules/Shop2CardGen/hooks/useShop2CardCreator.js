import { useState } from 'react'
import { shop2CardService } from '../services/shop2CardService'

export function useShop2CardCreator({ tasks = [], fetchData, refreshTable }) {
  const [selectedRow, setSelectedRow] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const openGenModal = (row) => {
    setSelectedRow(row)
    setError(null)
    setIsModalOpen(true)
  }

  const closeGenModal = () => {
    setSelectedRow(null)
    setIsModalOpen(false)
    setError(null)
  }

  const handleGenerateCards = async ({
    row,
    stage,
    batchSize,
    cardCount,
    machineName = 'Не вказано'
  }) => {
    if (!row) return
    setIsSubmitting(true)
    setError(null)

    try {
      const totalRequested = batchSize * cardCount
      if (totalRequested > row.availableQty) {
        throw new Error(`Запитувана кількість (${totalRequested} шт) перевищує доступний залишок буфера (${row.availableQty} шт)`)
      }

      // Collect available order pools for this part
      const availableOrderPools = (row.ordersList || [])
        .filter(o => o.availableQty > 0)
        .sort((a, b) => b.availableQty - a.availableQty) // Prioritize order with largest available pool

      let remainingToAllocate = totalRequested
      const cardsBatch = []

      // Create cards per required batch size, allocating from available order pools
      let cardSeq = 1
      for (let i = 0; i < cardCount; i++) {
        let cardQty = Math.min(batchSize, remainingToAllocate)
        if (cardQty <= 0) break

        // Pick matching order with available qty
        const currentPool = availableOrderPools.find(p => p.availableQty > 0) || availableOrderPools[0]
        const orderId = currentPool?.orderId && currentPool.orderId !== 'no-order' ? currentPool.orderId : null
        
        // Deduct from pool
        if (currentPool && currentPool.availableQty > 0) {
          currentPool.availableQty = Math.max(0, currentPool.availableQty - cardQty)
        }

        // Find or associate a Shop 2 task for this order
        let targetTask = tasks.find(t =>
          String(t.order_id) === String(orderId) &&
          (String(t.step || '').toLowerCase().includes('цех №2') || String(t.step || '').toLowerCase().includes('пресування'))
        )
        if (!targetTask && orderId) {
          targetTask = tasks.find(t => String(t.order_id) === String(orderId))
        }

        const taskId = targetTask?.id || orderId || row.nomId

        cardsBatch.push({
          taskId,
          orderId,
          nomenclatureId: row.nomId,
          operation: stage || 'Пресування',
          machine: machineName,
          quantity: cardQty,
          actualSheets: Math.ceil(cardQty / (row.unitsPerSheet || 1)),
          bufferQty: 0,
          cardInfo: `[SHOP:2] [STAGE:${stage}] №${cardSeq}/${cardCount} [REQ:${cardQty}]`,
          status: 'new',
          is_rework: false
        })

        remainingToAllocate -= cardQty
        cardSeq++
      }

      // Group cards by (taskId, orderId) and submit batch inserts
      const insertGroups = new Map()
      cardsBatch.forEach(c => {
        const key = `${c.taskId}_${c.orderId}_${c.nomenclatureId}`
        if (!insertGroups.has(key)) {
          insertGroups.set(key, {
            taskId: c.taskId,
            orderId: c.orderId,
            nomenclatureId: c.nomenclatureId,
            cardsBatch: []
          })
        }
        insertGroups.get(key).cardsBatch.push(c)
      })

      for (const group of insertGroups.values()) {
        await shop2CardService.createShop2CardsBatch({
          taskId: group.taskId,
          orderId: group.orderId,
          nomenclatureId: group.nomenclatureId,
          cardsBatch: group.cardsBatch
        })
      }

      if (typeof fetchData === 'function') {
        fetchData(['work_cards', 'tasks', 'inventory']).catch(() => {})
      }
      if (typeof refreshTable === 'function') {
        refreshTable()
      }

      closeGenModal()
    } catch (err) {
      console.error('[useShop2CardCreator] Generation error:', err)
      setError(err.message || 'Помилка при створенні карток Цеху №2')
    } finally {
      setIsSubmitting(false)
    }
  }

  return {
    selectedRow,
    isModalOpen,
    isSubmitting,
    error,
    openGenModal,
    closeGenModal,
    handleGenerateCards
  }
}
