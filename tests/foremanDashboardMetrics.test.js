import { describe, expect, it } from 'vitest'
import {
  calculateCurrentVkyaQuantity,
  calculateTerminalMetrics,
  getConfirmedSgpFromCards,
  getConfirmedSgpFromFlow,
  getForemanTaskScopeKey
} from '../src/modules/ForemanDashboard/utils/foremanDashboardMetrics.js'
import { buildCurrentVkyaIndex, buildCurrentVkyaOrderIndex, getLegacyCategoryOneQuantity, getPendingRecoverableQty } from '../src/modules/VKYA/quality-hold/qualityHoldModel.js'

describe('foreman dashboard terminal metrics', () => {
  it('keeps BZ fixed, uses confirmed SGP and excludes final scrap from WIP', () => {
    const metrics = calculateTerminalMetrics({
      initialStock: 120,
      flowSgpQty: 80,
      confirmedSgpCardsQty: 65,
      finalScrapQty: 7,
      currentVkyaQty: 11
    })

    expect(metrics).toEqual({
      qBz: 120,
      qSgp: 80,
      qScrap: 7,
      qVkya: 11,
      wipContribution: 211
    })
  })

  it('falls back to an explicit completed SGP transfer marker when flow totals are absent', () => {
    expect(calculateTerminalMetrics({ confirmedSgpCardsQty: 42 }).qSgp).toBe(42)
  })

  it('isolates separate batches of the same order', () => {
    expect(getForemanTaskScopeKey({ order_id: 'order-1', batch_index: 1 }))
      .not.toBe(getForemanTaskScopeKey({ order_id: 'order-1', batch_index: 2 }))
    expect(getForemanTaskScopeKey({ order_id: 'order-1', batch_index: null }))
      .toBe(getForemanTaskScopeKey({ order_id: 'order-1', batch_index: 0 }))
  })

  it('counts only the SGP portion of a direct transfer that also contains excess BZ', () => {
    const cards = [{
      id: 'card-1',
      status: 'completed',
      operation: 'Пакування/СГП',
      quantity: 120,
      card_info: '[NEED:95] [BZ:25] [ПРЯМА ПЕРЕДАЧА]'
    }]
    const flowRows = [{ card_id: 'card-1', stage_name: 'Пакування/СГП', total_good: 120 }]

    expect(getConfirmedSgpFromCards(cards)).toBe(95)
    expect(getConfirmedSgpFromFlow(flowRows, cards)).toBe(95)
  })

  it('does not treat a merely completed workshop card as an SGP transfer', () => {
    expect(getConfirmedSgpFromCards([{
      id: 'card-2', status: 'completed', operation: 'Доопрацювання', quantity: 50
    }])).toBe(0)
  })

  it('adds each current VKYA state once within its task and nomenclature', () => {
    expect(buildCurrentVkyaIndex([
      { task_id: 'task-1', nomenclature_id: 'part-1', source_type: 'quarantine', quantity: 3 },
      { task_id: 'task-1', nomenclature_id: 'part-1', source_type: 'recoverable', quantity: 4 },
      { task_id: 'task-1', nomenclature_id: 'part-1', source_type: 'restoration', quantity: 5 }
    ])).toEqual({ 'task-1': { 'part-1': 12 } })
  })

  it('keeps VKYA rows linked only by order in an order fallback index', () => {
    const items = [
      { task_id: 'task-1', order_id: 'order-1', nomenclature_id: 'part-1', scope_match: 'task', quantity: 2 },
      { task_id: 'old-task', order_id: 'order-1', nomenclature_id: 'part-1', scope_match: 'order', quantity: 98 }
    ]

    const taskIndex = buildCurrentVkyaIndex(items)
    const orderIndex = buildCurrentVkyaOrderIndex(items)

    expect(orderIndex).toEqual({ 'order-1': { 'part-1': 98 } })
    expect(taskIndex['task-1']['part-1'] + orderIndex['order-1']['part-1']).toBe(100)
  })

  it('keeps classified category 1 in VKYA until it is actually allocated', () => {
    expect(2 + getPendingRecoverableQty(98, 0)).toBe(100)
    expect(2 + getPendingRecoverableQty(98, 40)).toBe(60)
  })

  it('derives current VKYA from all card scrap minus only util and returned quantities', () => {
    expect(calculateCurrentVkyaQuantity({
      observedScrapQty: 100,
      finalScrapQty: 0,
      returnedToRouteQty: 0
    })).toBe(100)

    expect(calculateCurrentVkyaQuantity({
      observedScrapQty: 100,
      finalScrapQty: 7,
      returnedToRouteQty: 13
    })).toBe(80)
  })

  it('reads legacy category 1 from the quarantine history marker', () => {
    expect(getLegacyCategoryOneQuantity('[SCRAP_CAT:{"cat1":98,"cat4":0}]')).toBe(98)
  })
})
