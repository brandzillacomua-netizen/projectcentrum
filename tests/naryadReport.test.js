import { describe, expect, it } from 'vitest'
import {
  buildNaryadScrapSummary,
  calculateActualSheetsForPart,
  reconcileScrapDetailRows,
  scopeReportCards,
  summarizeReportProduction,
  summarizeReportParts
} from '../src/modules/Foreman/utils/naryadReport.js'

describe('naryad report aggregation', () => {
  it('keeps only cards from the requested task and order', () => {
    const cards = [
      { id: 'a', task_id: 'task-1', order_id: 'order-1' },
      { id: 'b', task_id: 'task-1', order_id: 'order-2' },
      { id: 'c', task_id: 'task-2', order_id: 'order-1' },
      { id: 'a', task_id: 'task-1', order_id: 'order-1' }
    ]

    expect(scopeReportCards(cards, 'task-1', 'order-1').map(card => card.id)).toEqual(['a'])
  })

  it('counts each production card once and does not treat the full plan as actual sheets', () => {
    const cards = [
      { id: 'a', task_id: 'task-1', order_id: 'order-1', nomenclature_id: 'part-1', quantity: 390 },
      { id: 'b', task_id: 'task-1', order_id: 'order-1', nomenclature_id: 'part-1', quantity: 156 },
      { id: 'redo', task_id: 'task-1', order_id: 'order-1', nomenclature_id: 'part-1', quantity: 3900, card_info: '[REDO]' },
      { id: 'stock', task_id: 'task-1', order_id: 'order-1', nomenclature_id: 'part-1', quantity: 3900, operation: 'Склад БЗ' },
      { id: 'other-order', task_id: 'task-1', order_id: 'order-2', nomenclature_id: 'part-1', quantity: 3900 }
    ]
    const historyRows = [
      { id: 'h1', card_id: 'a', scrap_qty: 1 },
      { id: 'h1', card_id: 'a', scrap_qty: 1 }
    ]

    expect(calculateActualSheetsForPart({
      cards,
      historyRows,
      taskId: 'task-1',
      orderId: 'order-1',
      nomenclatureId: 'part-1',
      unitsPerSheet: 39
    })).toBe(14)
  })

  it('reproduces the visible sheet progress for naryad 260826-1', () => {
    const rows = [
      ['part-1', 1810, 39, 47],
      ['part-2', 3797, 14, 272],
      ['part-3', 2438, 46, 53],
      ['part-4', 4080, 30, 136]
    ]
    const cards = rows.map(([nomenclatureId, quantity]) => ({
      id: `card-${nomenclatureId}`,
      task_id: '260826-1',
      order_id: 'order-260826-1',
      nomenclature_id: nomenclatureId,
      quantity
    }))

    const actualByPart = rows.map(([nomenclatureId, , unitsPerSheet]) => calculateActualSheetsForPart({
      cards,
      taskId: '260826-1',
      orderId: 'order-260826-1',
      nomenclatureId,
      unitsPerSheet
    }))

    expect(actualByPart).toEqual([47, 272, 53, 136])
    expect(actualByPart.reduce((sum, value) => sum + value, 0)).toBe(508)
  })

  it('matches the archive totals without duplicated returns or foreign-order scrap', () => {
    const cards = [
      { id: 'a', task_id: 'task-1', order_id: 'order-1' },
      { id: 'b', task_id: 'task-1', order_id: 'order-1' }
    ]
    const historyRows = [
      { id: 'h1', card_id: 'a', scrap_qty: 47 },
      { id: 'h2', card_id: 'b', scrap_qty: 77 },
      { id: 'h2', card_id: 'b', scrap_qty: 77 },
      { id: 'foreign', card_id: 'outside', scrap_qty: 999 }
    ]
    const finalScrapRows = [
      { id: 'f1', task_id: 'task-1', order_id: 'order-1', card_id: 'a', total_scrap: 20 },
      { id: 'f2', task_id: 'task-1', order_id: 'order-1', card_id: 'b', total_scrap: 47 },
      { id: 'f3', task_id: 'task-1', order_id: 'order-2', card_id: 'outside', total_scrap: 500 }
    ]

    expect(buildNaryadScrapSummary({
      cards,
      historyRows,
      finalScrapRows,
      returnedRows: [],
      taskId: 'task-1',
      orderId: 'order-1',
      hasFinalScrapProjection: true
    })).toEqual({ total: 124, util: 67, restoration: 0, inVkya: 57, returned: 0 })
  })

  it('uses the exact same part totals shown in the work-card archive', () => {
    const parts = [
      { observedScrap: 1, scrap: 1, qualityHold: 0, returnedVkya: 0 },
      { observedScrap: 17, scrap: 17, qualityHold: 0, returnedVkya: 0 },
      { observedScrap: 30, scrap: 0, qualityHold: 30, returnedVkya: 0 },
      { observedScrap: 76, scrap: 49, qualityHold: 27, returnedVkya: 0 }
    ]

    expect(summarizeReportParts(parts)).toEqual({
      total: 124,
      util: 67,
      restoration: 0,
      inVkya: 57,
      returned: 0
    })
  })

  it('reconciles detail rows with the total shown in the work-card archive', () => {
    const parts = [
      { taskId: 'task-1', nomId: 'nom-1', observedScrap: 76 },
      { taskId: 'task-1', nomId: 'nom-2', observedScrap: 30 }
    ]
    const rows = [
      { id: 'h-1', nomenclature_id: 'nom-1', scrap_qty: 70 },
      { id: 'h-2', nomenclature_id: 'nom-2', scrap_qty: 30 },
      { id: 'h-orphan', scrap_qty: 1 }
    ]

    const result = reconcileScrapDetailRows({ parts, rows })

    expect(result.reduce((sum, row) => sum + Number(row.scrap_qty || 0), 0)).toBe(106)
    expect(result).toContainEqual(expect.objectContaining({
      nomenclature_id: 'nom-1',
      stage_name: 'Архів карток / ВКЯ',
      scrap_qty: 5
    }))
  })

  it('separates parts handed off by shop 1 from BZ supply', () => {
    const parts = [{
      taskId: 'task-1',
      nomId: 'nom-1',
      name: 'Деталь 1',
      need: 60000,
      stockBZ: 58190,
      plan: 1810,
      produced: 59905,
      cards: [
        { id: 'bz', operation: 'Склад БЗ', status: 'completed', quantity: 58190 },
        { id: 'shop', operation: 'Розкрій', status: 'completed', quantity: 1715 }
      ]
    }]

    expect(summarizeReportProduction(parts)).toEqual(expect.objectContaining({
      need: 60000,
      plannedBz: 58190,
      plannedShop1: 1810,
      fromBz: 58190,
      fromShop1: 1715,
      acceptedTotal: 59905
    }))
  })
})
