import { useState } from 'react'
import { shop2CardService } from '../services/shop2CardService'
import { isPackagingOperation } from '../constants/shop2Stages'

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

      // Clone available order pools so we never mutate component props / state
      const availableOrderPools = (row.ordersList || [])
        .filter(o => o.availableQty > 0)
        .map(o => ({ ...o }))
        .sort((a, b) => b.availableQty - a.availableQty) // Prioritize order with largest available pool

      // If no order pools with availableQty > 0, fallback to general part buffer
      if (availableOrderPools.length === 0) {
        availableOrderPools.push({
          orderId: null,
          orderNum: 'Без наряду',
          availableQty: row.availableQty
        })
      }

      let remainingToAllocate = totalRequested
      const cardsBatch = []
      const isUuid = str => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
      const isDirectPack = isPackagingOperation(stage)

      // Allocate across order pools strictly respecting each pool's availableQty
      for (const pool of availableOrderPools) {
        if (remainingToAllocate <= 0) break

        const orderId = pool.orderId && pool.orderId !== 'no-order' && isUuid(pool.orderId) ? pool.orderId : null
        const allocForThisOrder = Math.min(pool.availableQty, remainingToAllocate)
        if (allocForThisOrder <= 0) continue

        // Find or associate a Shop 2 task for this order
        let targetTask = tasks.find(t =>
          String(t.order_id) === String(orderId) &&
          (String(t.step || '').toLowerCase().includes('цех №2') || String(t.step || '').toLowerCase().includes('пресування'))
        )
        if (!targetTask && orderId) {
          targetTask = tasks.find(t => String(t.order_id) === String(orderId))
        }

        const taskId = isUuid(targetTask?.id) ? targetTask.id : (isUuid(orderId) ? orderId : (isUuid(row.nomId) ? row.nomId : null))

        // Split allocForThisOrder into cards based on requested batchSize
        let orderRemaining = allocForThisOrder
        while (orderRemaining > 0) {
          const cardQty = Math.min(batchSize, orderRemaining)
          orderRemaining -= cardQty

          const baseCardInfo = `[SHOP:2] [STAGE:${stage}] [REQ:${cardQty}]`
          const cardInfo = isDirectPack ? `${baseCardInfo} [ПРЯМА ПЕРЕДАЧА СГП]` : baseCardInfo

          cardsBatch.push({
            taskId,
            orderId,
            nomenclatureId: row.nomId,
            operation: stage || 'Пресування',
            machine: machineName,
            quantity: cardQty,
            actualSheets: Math.ceil(cardQty / (row.unitsPerSheet || 1)),
            bufferQty: 0,
            cardInfo,
            status: isDirectPack ? 'completed' : 'new',
            completed_at: isDirectPack ? new Date().toISOString() : null,
            is_rework: false
          })
        }

        remainingToAllocate -= allocForThisOrder
      }

      // Add clean sequence numbering to all generated cards (№1/N, №2/N...)
      const totalCreatedCards = cardsBatch.length
      cardsBatch.forEach((c, idx) => {
        c.cardInfo = c.cardInfo.replace(`[STAGE:${stage}]`, `[STAGE:${stage}] №${idx + 1}/${totalCreatedCards}`)
      })

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
