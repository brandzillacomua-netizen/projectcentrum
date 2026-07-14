import { useState } from 'react'
import { buildReissuePlan } from './reissueCalculations.js'

export function useReissueActions({ createWorkCardsBatch, createDovypuskMaterialRequests, fetchData, machines }) {
  const [isReissuing, setIsReissuing] = useState(false)
  const [error, setError] = useState(null)

  const createReissue = async ({ task, part, capacityOverride = null }) => {
    setError(null)
    const plan = buildReissuePlan({ task, part, machines, capacityOverride })
    if (!plan.valid) {
      setError(plan.reason)
      throw new Error(plan.reason)
    }

    setIsReissuing(true)
    try {
      const createdCards = await createWorkCardsBatch(task.id, task.order_id, part.nomId, plan.cards)
      if (!createdCards || createdCards.length === 0) {
        throw new Error('Картки довипуску не були створені.')
      }

      if (typeof createDovypuskMaterialRequests === 'function') {
        for (let idx = 0; idx < plan.cards.length; idx += 1) {
          const plannedCard = plan.cards[idx]
          const createdCard = createdCards[idx]
          const qtyForCard = Number(plannedCard.quantity) || 0
          const sheetsForCard = Number(plannedCard.sheets) || Math.ceil(qtyForCard / plan.unitsPerSheet)
          if (sheetsForCard <= 0 || qtyForCard <= 0) continue
          await createDovypuskMaterialRequests(
            task.id,
            task.order_id,
            part.nom,
            sheetsForCard,
            qtyForCard,
            plannedCard.machine || plan.machine.name,
            createdCard?.id || null
          )
        }
      }

      if (typeof fetchData === 'function') {
        fetchData(['work_cards', 'material_requests', 'tasks']).catch(() => {})
      }

      return { ...plan, createdCards }
    } catch (err) {
      setError(err.message)
      throw err
    } finally {
      setIsReissuing(false)
    }
  }

  return { createReissue, isReissuing, error }
}
