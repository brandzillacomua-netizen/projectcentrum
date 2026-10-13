import { describe, expect, it, vi } from 'vitest'
import {
  buildRequestAllocations,
  consumeCuttingInventoryOnce
} from '../src/services/atomicInventoryService.js'

describe('cutting inventory consumption', () => {
  it('allocates only the reservation share that belongs to the completed card', () => {
    expect(buildRequestAllocations([
      { id: 'request-a', quantity: 3 },
      { id: 'request-b', quantity: 5 }
    ], 4)).toEqual([
      { id: 'request-a', quantity: 3 },
      { id: 'request-b', quantity: 1 }
    ])
  })

  it('sends exact card consumption and stable receipt key to the database', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { success: true, replayed: false }, error: null })
    const supabase = { rpc }

    await consumeCuttingInventoryOnce(supabase, {
      cardId: 'card-1',
      consumptionKey: 'sheet:stock-1',
      inventoryId: 'stock-1',
      deductTotal: 8,
      releaseReserved: 8,
      requestAllocations: [{ id: 'request-1', quantity: 8 }]
    })

    expect(rpc).toHaveBeenCalledExactlyOnceWith('rpc_consume_cutting_inventory_once', {
      p_card_id: 'card-1',
      p_consumption_key: 'sheet:stock-1',
      p_inventory_id: 'stock-1',
      p_deduct_total: 8,
      p_release_reserved: 8,
      p_request_allocations: [{ id: 'request-1', quantity: 8 }]
    })
  })

  it('fails closed when the database does not confirm consumption', async () => {
    const supabase = {
      rpc: async () => ({ data: { success: false, error: 'rejected' }, error: null })
    }

    await expect(consumeCuttingInventoryOnce(supabase, {
      cardId: 'card-1',
      consumptionKey: 'cutter:cutter-1',
      inventoryId: 'stock-2',
      deductTotal: 6,
      releaseReserved: 4
    })).rejects.toThrow('rejected')
  })

  it('explains a missing production migration without advancing the card', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find rpc_consume_cutting_inventory_once' }
      })
    }

    await expect(consumeCuttingInventoryOnce(supabase, {
      cardId: 'card-1',
      consumptionKey: 'sheet:stock-1',
      inventoryId: 'stock-1',
      deductTotal: 4,
      releaseReserved: 4
    })).rejects.toThrow('ще не встановлено захищене списання')
  })
})
