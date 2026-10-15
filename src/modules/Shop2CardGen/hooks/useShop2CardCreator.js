import { useState } from 'react'
import { shop2CardService } from '../services/shop2CardService'
import { isPackagingOperation } from '../constants/shop2Stages'
import { buildRerunToParentOrderMap } from '../utils/shop2BufferCalculations'
import { resolveCanonicalNomId } from '../../Nomenclature/utils/nomenclatureHelpers'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * All nomenclature IDs that the buffer table folds into `canonicalId`
 * (legacy V1 IDs + any catalog row resolving to it). Must mirror useShop2BufferData.
 */
export function collectSourceNomenclatureIds(canonicalId, nomenclatures = []) {
  const ids = new Set()
  const canon = String(canonicalId || '')
  ;(nomenclatures || []).forEach(n => {
    if (!n) return
    if (String(n.id) === canon) {
      ;(Array.isArray(n.legacy_ids) ? n.legacy_ids : []).forEach(id => ids.add(String(id)))
      if (n.legacy_id) ids.add(String(n.legacy_id))
    } else if (resolveCanonicalNomId(n.id, nomenclatures) === canon) {
      ids.add(String(n.id))
    }
  })
  ids.delete(canon)
  return [...ids].filter(id => UUID_RE.test(id))
}

/**
 * Parent order + its rerun (-Д) child orders — the buffer table rolls child
 * buffer cards into the parent pool, so the server must deduct from them too.
 */
export function collectSourceOrderIds(orderId, orders = []) {
  if (!orderId) return []
  const rerunMap = buildRerunToParentOrderMap(orders)
  const ids = [String(orderId)]
  rerunMap.forEach((parentId, childId) => {
    if (String(parentId) === String(orderId)) ids.push(String(childId))
  })
  return ids.filter(id => UUID_RE.test(id))
}

export function useShop2CardCreator({ tasks = [], orders = [], nomenclatures = [], fetchData, refreshTable }) {
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

        // Find or associate an active task for this order (Packaging task, legacy Shop 2 task, or any task of this order)
        let targetTask = tasks.find(t =>
          String(t.order_id) === String(orderId) &&
          (String(t.step || '').toLowerCase().includes('пакування') || String(t.step || '').toLowerCase().includes('цех №2') || String(t.step || '').toLowerCase().includes('пресування'))
        )
        if (!targetTask && orderId) {
          targetTask = tasks.find(t => String(t.order_id) === String(orderId))
        }

        const taskId = isUuid(targetTask?.id) ? targetTask.id : null

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
            operation: isDirectPack ? 'Склад СГП' : (stage || 'Пресування'),
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

      const sourceNomenclatureIds = collectSourceNomenclatureIds(row.nomId, nomenclatures)

      for (const group of insertGroups.values()) {
        await shop2CardService.createShop2CardsBatch({
          taskId: group.taskId,
          orderId: group.orderId,
          nomenclatureId: group.nomenclatureId,
          cardsBatch: group.cardsBatch,
          sourceOrderIds: collectSourceOrderIds(group.orderId, orders),
          sourceNomenclatureIds
        })
      }

      if (typeof fetchData === 'function') {
        fetchData(['work_cards', 'tasks', 'inventory']).catch(() => {})
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
