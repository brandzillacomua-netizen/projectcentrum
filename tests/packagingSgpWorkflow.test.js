import { describe, expect, it } from 'vitest'
import { getPackagingItemFulfillment, getRequestFulfillmentForNomenclature } from '../src/modules/Packaging/utils/packagingHelpers.js'
import {
  getAvailableStockByNomenclatureId,
  getGroupedSgpAvailableStock,
  getGroupedSgpIssueAllocations,
  getGroupedSgpIssueRow,
  getGroupedSgpRow
} from '../src/modules/WarehouseFGP/warehouseFgpInventory.js'

describe('packaging and SGP request fulfillment', () => {
  it('adds all issued portions and leaves the missing quantity requestable', () => {
    const fulfillment = getRequestFulfillmentForNomenclature([
      { nomenclature_id: 'part-1', status: 'issued', quantity: 26 },
      { nomenclature_id: 'part-1', status: 'completed', quantity: 74 },
      { nomenclature_id: 'other', status: 'issued', quantity: 999 }
    ], 'part-1')

    expect(fulfillment.issuedQty).toBe(100)
    expect(3474 - fulfillment.issuedQty).toBe(3374)
    expect(fulfillment.hasPending).toBe(false)
  })

  it('reports a pending follow-up request separately from an initial reservation', () => {
    const fulfillment = getRequestFulfillmentForNomenclature([
      { nomenclature_id: 'part-1', status: 'issued', quantity: 26 },
      { nomenclature_id: 'part-1', status: 'pending', quantity: 3448 }
    ], 'part-1')

    expect(fulfillment.issuedQty).toBe(26)
    expect(fulfillment.hasPending).toBe(true)
  })

  it('subtracts the quantity reserved when the order was created from the follow-up request', () => {
    const item = { nom: { id: 'part-1' }, qty: 3474, initialReservedQty: 26 }
    const fulfillment = getPackagingItemFulfillment([], item)

    expect(fulfillment.fulfilledQty).toBe(26)
    expect(item.qty - fulfillment.fulfilledQty).toBe(3448)
  })

  it('uses one concrete SGP inventory row by ID instead of summing duplicate rows', () => {
    const inventory = [
      { id: 'main-stock', nomenclature_id: 'part-1', name: 'Same name', type: 'wip_bz', total_qty: 23279, reserved_qty: 151 },
      { nomenclature_id: 'part-1', name: 'Operational row', type: 'raw', warehouse: 'operational', total_qty: 3892, reserved_qty: 0 },
      { nomenclature_id: 'part-1', name: 'SGP raw row', type: 'raw', warehouse: 'sgp', total_qty: 9, reserved_qty: 0 },
      { id: 'duplicate-stock', nomenclature_id: 'part-1', name: 'Duplicate SGP row', type: 'wip_bz', total_qty: 9, reserved_qty: 0 },
      { nomenclature_id: 'wrong-id', name: 'Same name', total_qty: 50000, reserved_qty: 0 }
    ]

    expect(getAvailableStockByNomenclatureId(inventory, 'part-1')).toBe(23128)
  })

  it('uses the exact free balance displayed by the grouped SGP inventory table', () => {
    const rawItem = { id: 'correct-inventory-row', nomenclature_id: 'canonical-part', name: 'F415-ІП27-П-10-38', type: 'wip_bz', total_qty: 23279, reserved_qty: 151 }
    const groupedItems = [
      { nomenclature_id: 'canonical-part', name: 'F415-ІП27-П-10-38', total_qty: 23279, reserved_qty: 151, rawItems: [rawItem] }
    ]
    const nomenclatures = [
      { id: 'canonical-part', legacy_ids: ['request-duplicate-id'], name: 'F415-ІП27-П-10-38' }
    ]
    const request = { nomenclature_id: 'request-duplicate-id' }

    expect(getGroupedSgpAvailableStock(groupedItems, nomenclatures, request)).toBe(23128)
    expect(getGroupedSgpRow(groupedItems, nomenclatures, request)).toBe(groupedItems[0])
    expect(getGroupedSgpIssueRow(groupedItems, nomenclatures, request)).toBe(rawItem)
  })

  it('splits one request across multiple SGP inventory rows', () => {
    const groupedItems = [{
      nomenclature_id: 'canonical-part',
      name: 'F415-ІП27-К-3-9',
      rawItems: [
        { id: 'row-1', name: 'F415-ІП27-К-3-9', type: 'wip_bz', total_qty: 3413, reserved_qty: 0 },
        { id: 'row-2', name: 'F415-ІП27-К-3-9', type: 'wip_bz', total_qty: 3211, reserved_qty: 54 }
      ]
    }]
    const nomenclatures = [{ id: 'canonical-part', legacy_ids: ['legacy-request-id'], name: 'F415-ІП27-К-3-9' }]
    const request = { nomenclature_id: 'legacy-request-id' }

    const result = getGroupedSgpIssueAllocations(groupedItems, nomenclatures, request, 3446)
    expect(result.availableQty).toBe(6570)
    expect(result.remainingQty).toBe(0)
    expect(result.allocations.map(item => item.quantity)).toEqual([3413, 33])
  })
})
