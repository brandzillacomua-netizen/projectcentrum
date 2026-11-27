import { describe, it, expect, vi } from 'vitest'
import { recordManualInventoryDelta, resolveAdjustmentActor } from '../src/modules/WarehouseFGP/utils/sgpManualAdjustment'

describe('SGP manual adjustment audit helper', () => {
  it('resolves actor name and numeric id from currentUser', () => {
    expect(resolveAdjustmentActor({ id: '55', first_name: 'Анатолій', last_name: 'Душинський' })).toEqual({
      actorId: 55,
      actorName: 'Анатолій Душинський'
    })
  })

  it('calls adjust_inventory_manually with add when newTotal > oldTotal', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'adj-1' }, error: null })
    await recordManualInventoryDelta({
      supabase: { rpc },
      inventoryId: 'inv-1',
      oldTotal: 0,
      newTotal: 200,
      currentUser: { id: 55, first_name: 'Анатолій', last_name: 'Душинський' },
      reason: 'Створення нової позиції на СГП'
    })

    expect(rpc).toHaveBeenCalledWith('adjust_inventory_manually', {
      p_inventory_id: 'inv-1',
      p_action: 'add',
      p_delta_qty: 200,
      p_actor_id: 55,
      p_actor_name: 'Анатолій Душинський',
      p_reason: 'Створення нової позиції на СГП',
      p_source_module: 'warehouse_fgp'
    })
  })

  it('calls adjust_inventory_manually with subtract when newTotal < oldTotal', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: 'adj-2' }, error: null })
    await recordManualInventoryDelta({
      supabase: { rpc },
      inventoryId: 'inv-1',
      oldTotal: 200,
      newTotal: 150,
      currentUser: { id: 55, login: 'tolik' },
      reason: 'Ручне редагування залишку в таблиці СГП'
    })

    expect(rpc).toHaveBeenCalledWith('adjust_inventory_manually', {
      p_inventory_id: 'inv-1',
      p_action: 'subtract',
      p_delta_qty: 50,
      p_actor_id: 55,
      p_actor_name: 'tolik',
      p_reason: 'Ручне редагування залишку в таблиці СГП',
      p_source_module: 'warehouse_fgp'
    })
  })

  it('skips RPC when total did not change', async () => {
    const rpc = vi.fn()
    const res = await recordManualInventoryDelta({
      supabase: { rpc },
      inventoryId: 'inv-1',
      oldTotal: 100,
      newTotal: 100
    })
    expect(res).toBeNull()
    expect(rpc).not.toHaveBeenCalled()
  })
})
