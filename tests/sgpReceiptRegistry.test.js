import { describe, expect, it } from 'vitest'
import {
  buildSgpReceiptRegistry,
  filterSgpReceiptRegistry,
  isSgpReceiptHistory
} from '../src/modules/WarehouseFGP/utils/sgpReceiptRegistry.js'

describe('SGP receipt registry', () => {
  const data = {
    history: [
      {
        id: 'receipt-old',
        card_id: 'card-1',
        nomenclature_id: 'nom-1',
        stage_name: 'Пакування/СГП',
        operator_name: 'Система (ТЕРМІНАЛ)',
        qty_completed: 26,
        scrap_qty: 0,
        completed_at: '2026-10-07T10:00:00.000Z'
      },
      {
        id: 'not-a-receipt',
        card_id: 'card-1',
        nomenclature_id: 'nom-1',
        stage_name: 'Фарбування',
        qty_completed: 26,
        scrap_qty: 0,
        completed_at: '2026-10-07T11:00:00.000Z'
      },
      {
        id: 'receipt-new',
        card_id: 'card-2',
        nomenclature_id: 'nom-2',
        stage_name: 'Пакування/СГП',
        operator_name: 'Система (ПРЯМА ПЕРЕДАЧА)',
        qty_completed: 104,
        scrap_qty: 0,
        completed_at: '2026-10-07T12:00:00.000Z'
      }
    ],
    workCards: [
      { id: 'card-1', task_id: 'task-1', order_id: 'order-1', nomenclature_id: 'nom-1', card_info: '[ЦЕХ №2]' },
      { id: 'card-2', task_id: 'task-1', order_id: 'order-1', nomenclature_id: 'nom-2', card_info: '[ЦЕХ №2] [ПРЯМА ПЕРЕДАЧА]' }
    ],
    tasks: [{ id: 'task-1', order_id: 'order-1', batch_index: 5 }],
    orders: [{ id: 'order-1', order_num: '261001-5' }],
    nomenclatures: [
      { id: 'nom-1', name: 'Деталь А', code: 'V2-1' },
      { id: 'nom-2', name: 'Деталь Б', code: 'V2-2' }
    ]
  }

  it('recognizes only positive, non-scrap receipt events at SGP', () => {
    expect(isSgpReceiptHistory(data.history[0])).toBe(true)
    expect(isSgpReceiptHistory(data.history[1])).toBe(false)
    expect(isSgpReceiptHistory({ ...data.history[0], qty_completed: 0 })).toBe(false)
  })

  it('builds one newest-first registry row for every received package', () => {
    const rows = buildSgpReceiptRegistry(data)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({
      id: 'receipt-new',
      detailName: 'Деталь Б',
      detailCode: 'V2-2',
      quantity: 104,
      source: 'Цех №2 • пряма передача',
      orderNumber: '261001-5',
      batchIndex: 5
    })
    expect(rows[1].source).toBe('Цех №2 • термінал пакування')
  })

  it('searches by part, code, source, order, card and operator', () => {
    const rows = buildSgpReceiptRegistry(data)
    expect(filterSgpReceiptRegistry(rows, 'V2-1')).toHaveLength(1)
    expect(filterSgpReceiptRegistry(rows, 'пряма')).toHaveLength(1)
    expect(filterSgpReceiptRegistry(rows, '261001-5')).toHaveLength(2)
  })
})
