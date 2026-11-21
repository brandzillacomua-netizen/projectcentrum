import { describe, expect, it } from 'vitest'
import {
  getAvailableSGPStock,
  getPendingSgpPackagingDemand
} from '../src/modules/Nomenclature/utils/nomenclatureHelpers.js'

describe('SGP available stock for new naryads', () => {
  const partNom = { id: 'nom-1', name: 'Пластина А', legacy_ids: ['nom-old-1'] }
  const inventory = [
    {
      id: 'inv-1',
      nomenclature_id: 'nom-1',
      name: 'Пластина А',
      type: 'finished',
      warehouse: 'sgp',
      total_qty: 100,
      reserved_qty: 20,
      pocket_owner: null
    }
  ]

  it('returns total_qty - reserved_qty when requests are omitted', () => {
    expect(getAvailableSGPStock(partNom, inventory)).toBe(80)
  })

  it('subtracts pending/processing SGP packaging demand without double-counting issued/completed', () => {
    const requests = [
      {
        id: 'r1',
        order_id: 'ord-other',
        nomenclature_id: 'nom-1',
        quantity: 30,
        status: 'pending',
        target_warehouse: 'sgp',
        details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (ЗМ-100) [PACKAGING_SOURCE:SGP]: Пластина А — 30 шт.'
      },
      {
        id: 'r2',
        order_id: 'ord-other-2',
        nomenclature_id: 'nom-old-1',
        quantity: 10,
        status: 'processing',
        category: 'packaging',
        details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (ЗМ-101): Пластина А — 10 шт.'
      },
      {
        id: 'r3',
        order_id: 'ord-issued',
        nomenclature_id: 'nom-1',
        quantity: 20,
        status: 'issued',
        target_warehouse: 'sgp',
        details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (ЗМ-102) [PACKAGING_SOURCE:SGP]: Пластина А — 20 шт.'
      },
      {
        id: 'r4',
        order_id: 'ord-self',
        nomenclature_id: 'nom-1',
        quantity: 15,
        status: 'pending',
        target_warehouse: 'sgp',
        details: 'ЗАПИТ НА КОМПЛЕКТУВАННЯ (ЗМ-103) [PACKAGING_SOURCE:SGP]: Пластина А — 15 шт.'
      }
    ]

    expect(getPendingSgpPackagingDemand(partNom, requests, 'ord-self')).toBe(40)
    expect(getAvailableSGPStock(partNom, inventory, requests, 'ord-self')).toBe(40)
  })
})
