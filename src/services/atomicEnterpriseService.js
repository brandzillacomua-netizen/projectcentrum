/**
 * Atomic Enterprise Service
 * Provides transactionally safe operations for Centrum MES/ERP.
 * Uses PostgreSQL row-level locks (SELECT ... FOR UPDATE) via Supabase RPCs.
 */

import { supabase } from '../supabase.js'

/**
 * Deducts inventory total_qty and/or releases reserved_qty atomically.
 */
export async function deductInventoryAtomic({ inventoryId, deductTotal = 0, releaseReserved = 0 }) {
  if (!inventoryId) return { success: false, error: 'inventoryId is required' }

  try {
    const { data, error } = await supabase.rpc('rpc_deduct_inventory_atomic', {
      p_inventory_id: inventoryId,
      p_deduct_total: Number(deductTotal) || 0,
      p_release_reserved: Number(releaseReserved) || 0
    })

    if (error) {
      console.error('[AtomicEnterprise] RPC deduct_inventory_atomic failed (Fail-Closed):', error.message)
      throw error
    }
    
    if (!data?.success) {
      throw new Error(data?.error || 'Server rejected inventory deduction')
    }

    return { success: true, data }
  } catch (err) {
    console.error('[AtomicEnterprise] Unhandled Exception (Fail-Closed):', err.message)
    throw err
  }
}

/**
 * Confirms cutting buffer completion with single-route atomic write-off
 * of both sheets and cutters in a single database transaction.
 */
export async function confirmBufferCuttingAtomic({
  cardId,
  nextStatus,
  sheetInvId = null,
  sheetDeductTotal = 0,
  sheetReleaseReserved = 0,
  cutterDeductions = []
}) {
  if (!cardId || !nextStatus) return { success: false, error: 'cardId and nextStatus are required' }

  try {
    const { data, error } = await supabase.rpc('rpc_confirm_buffer_cutting_atomic', {
      p_card_id: cardId,
      p_next_status: nextStatus,
      p_sheet_inv_id: sheetInvId,
      p_sheet_deduct_total: Number(sheetDeductTotal) || 0,
      p_sheet_release_reserved: Number(sheetReleaseReserved) || 0,
      p_cutter_deductions: cutterDeductions
    })

    if (error) {
      console.error('[AtomicEnterprise] RPC confirm_buffer_cutting_atomic failed (Fail-Closed):', error.message)
      throw error
    }

    if (!data?.success) {
      throw new Error(data?.error || 'Server rejected buffer cutting confirmation')
    }

    return { success: true, data }
  } catch (err) {
    console.error('[AtomicEnterprise] Unhandled Exception (Fail-Closed):', err.message)
    throw err
  }
}
