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

  it('replays gracefully when consumption was already recorded with different quantity', async () => {
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'Cutting consumption retry has different quantities for card card-1 and key cutter:nom-1:inv-1' }
      })
    }

    const res = await consumeCuttingInventoryOnce(supabase, {
      cardId: 'card-1',
      consumptionKey: 'cutter:nom-1:inv-1',
      inventoryId: 'inv-1',
      deductTotal: 12,
      releaseReserved: 4
    })

    expect(res.success).toBe(true)
    expect(res.replayed).toBe(true)
  })

  it('falls back to negative stock deduction when RPC rejects with Insufficient stock', async () => {
    let updatedPayload = null
    const supabase = {
      rpc: async () => ({
        data: null,
        error: { message: 'Insufficient stock: available 2.00, requested 4' }
      }),
      from: (table) => {
        if (table === 'inventory') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'stock-1', total_qty: 2, reserved_qty: 2 }
                })
              })
            }),
            update: (payload) => ({
              eq: async () => {
                updatedPayload = payload
                return { error: null }
              }
            })
          }
        }
        if (table === 'material_requests') {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: 'req-1', quantity: 2 }
                })
              })
            }),
            update: () => ({
              eq: async () => ({ error: null })
            })
          }
        }
        return {}
      }
    }

    const res = await consumeCuttingInventoryOnce(supabase, {
      cardId: 'card-1',
      consumptionKey: 'sheet:stock-1',
      inventoryId: 'stock-1',
      deductTotal: 4,
      releaseReserved: 2,
      requestAllocations: [{ id: 'req-1', quantity: 2 }]
    })

    expect(res.success).toBe(true)
    expect(res.allowedNegative).toBe(true)
    expect(res.new_total).toBe(-2)
    expect(updatedPayload?.total_qty).toBe(-2)
    expect(updatedPayload?.reserved_qty).toBe(0)
  })
})
