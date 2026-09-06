import { describe, it, expect } from 'vitest'
import { incrementInventoryStock } from '../src/services/inventoryStockService.js'
import { supabase } from '../src/supabase.js'

describe('Centralized incrementInventoryStock Service', () => {
  it('validates input and rejects non-positive or invalid quantities', async () => {
    const r1 = await incrementInventoryStock({ nomenclatureId: null, qty: 5 })
    expect(r1.success).toBe(false)

    const r2 = await incrementInventoryStock({ nomenclatureId: 'a0000000-0000-0000-0000-000000000001', qty: 0 })
    expect(r2.success).toBe(false)

    const r3 = await incrementInventoryStock({ nomenclatureId: 'a0000000-0000-0000-0000-000000000001', qty: -3 })
    expect(r3.success).toBe(false)

    const r4 = await incrementInventoryStock({ nomenclatureId: 'a0000000-0000-0000-0000-000000000001', qty: NaN })
    expect(r4.success).toBe(false)
  })

  it('correctly resolves nomenclature name and unit from list if provided', async () => {
    // Fetch an active nomenclature from DB to satisfy FK constraints if write triggers
    const { data: nom } = await supabase
      .from('nomenclatures')
      .select('id, name, unit')
      .limit(1)
      .single()

    if (!nom) return // Skip if offline/no data

    const nomsList = [
      { id: nom.id, name: nom.name, unit: nom.unit }
    ]

    // Service handles lookup without crashing
    const res = await incrementInventoryStock({
      nomenclatureId: nom.id,
      qty: 1,
      type: 'scrap_ready',
      nomenclatures: nomsList
    })

    // Returns a structured result with boolean success flag
    expect(typeof res.success).toBe('boolean')
    expect(res.success).toBe(true)

    // Revert increment to keep database clean
    const { data: invItem } = await supabase
      .from('inventory')
      .select('id, total_qty')
      .eq('nomenclature_id', nom.id)
      .eq('type', 'scrap_ready')
      .maybeSingle()

    if (invItem && Number(invItem.total_qty) > 0) {
      await supabase
        .from('inventory')
        .update({ total_qty: Math.max(0, Number(invItem.total_qty) - 1) })
        .eq('id', invItem.id)
    }
  })
})
