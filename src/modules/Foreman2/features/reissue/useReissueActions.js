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
        await createDovypuskMaterialRequests(
          task.id,
          task.order_id,
          part.nom,
          plan.sheets,
          plan.totalQty,
          plan.machine.name,
          createdCards[0]?.id || null
        )
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
