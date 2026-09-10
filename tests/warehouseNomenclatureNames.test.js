import { describe, expect, it, vi } from 'vitest'
import { supabase } from '../src/supabase.js'
import { useDataFetchers } from '../src/contexts/data/dataFetchers.js'
import { getInventoryDisplayName } from '../src/modules/Warehouse/utils/inventoryDisplayName.js'

vi.mock('../src/supabase.js', () => ({ supabase: { from: vi.fn() } }))

describe('Warehouse working sheet names', () => {
  it('keeps the V2 name when a legacy sheet has the same ID and a different name', async () => {
    const legacy = { id: 'sheet-7', name: 'Лист Т300 (7мм) [Підготовлений] (7мм)', type: 'raw' }
    const canonical = { id: 'sheet-7', name: 'Лист Т300 (7мм)', code: 'V2-SHT-008', group_id: 'grp_prepared_sheets' }
    supabase.from.mockImplementation(table => ({
      select: () => ({ limit: async () => ({ data: table === 'nomenclatures_v2' ? [canonical] : [legacy] }) })
    }))
    const setNomenclatures = vi.fn()
    const state = {
      setNomenclatures,
      nomenclaturesRef: { current: [] },
      nomenclaturesLoadedRef: { current: false }
    }
    await useDataFetchers(state).refreshTable('nomenclatures')
    expect(setNomenclatures).toHaveBeenCalledOnce()
    expect(state.nomenclaturesRef.current).toHaveLength(1)
    expect(state.nomenclaturesRef.current[0]).toMatchObject(canonical)
    const stock = { name: legacy.name, nomenclature_id: legacy.id, total_qty: 32, reserved_qty: 5 }
    expect(getInventoryDisplayName(stock, state.nomenclaturesRef.current)).toBe(canonical.name)
    expect(stock).toEqual({ name: legacy.name, nomenclature_id: legacy.id, total_qty: 32, reserved_qty: 5 })
  })

  it('preserves unprepared sheets and unmatched inventory labels', () => {
    const sheets = [{ id: 'sheet', name: 'Лист Т300 (7мм)', group_id: 'grp_prepared_sheets', legacy_ids: ['old-sheet'] }]
    expect(getInventoryDisplayName({ name: 'Лист Т300 (7мм) [Підготовлений]', nomenclature_id: 'old-sheet' }, sheets)).toBe(sheets[0].name)
    for (const item of [
      { name: 'Лист Т300 (7мм) [Непідготовлений]', nomenclature_id: 'sheet' },
      { name: 'Гума листова', nomenclature_id: 'rubber' },
      { name: 'Лист Т300 (7мм) [Підготовлений]' }
    ]) expect(getInventoryDisplayName(item, sheets)).toBe(item.name)
  })
})
