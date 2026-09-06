/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: ATOMIC INVENTORY STOCK SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 * Increments operational inventory stock (e.g. scrap_ready, semi) using
 * PostgreSQL RPC `rpc_increment_inventory_stock` with ACID row-locking (`FOR UPDATE`).
 * 
 * Provides 100% Graceful Fallback to sequential HTTP writes if RPC is not yet installed.
 */

import { supabase } from '../supabase.js'
import { sentryLogger } from './sentryLogger.js'

/**
 * Increment inventory stock atomically
 * 
 * @param {Object} params
 * @param {string} params.nomenclatureId - Nomenclature UUID
 * @param {number} params.qty - Quantity to add
 * @param {string} [params.type='scrap_ready'] - Inventory type ('scrap_ready', 'semi', etc.)
 * @param {string} [params.itemName='Деталь'] - Fallback name of item if creating record
 * @param {string} [params.unit='шт'] - Fallback unit
 * @param {Array} [params.nomenclatures=[]] - Optional nomenclatures list for name/unit lookup
 * @returns {Promise<{success: boolean, viaRpc: boolean, data?: any, error?: any}>}
 */
export async function incrementInventoryStock({
  nomenclatureId,
  qty,
  type = 'scrap_ready',
  itemName = 'Деталь',
  unit = 'шт',
  nomenclatures = []
}) {
  const numQty = Number(qty)
  if (!nomenclatureId || !Number.isFinite(numQty) || numQty <= 0) {
    return { success: false, error: 'Invalid nomenclatureId or non-positive quantity' }
  }

  // Resolve item name and unit from list if available
  let resolvedName = itemName
  let resolvedUnit = unit
  if (Array.isArray(nomenclatures) && nomenclatures.length > 0) {
    const found = nomenclatures.find(n => n.id === nomenclatureId)
    if (found) {
      resolvedName = found.name || resolvedName
      resolvedUnit = found.unit || resolvedUnit
    }
  }

  // 1. Primary path: Atomic PostgreSQL RPC with FOR UPDATE row lock
  try {
    const { data, error } = await supabase.rpc('rpc_increment_inventory_stock', {
      p_nomenclature_id: nomenclatureId,
      p_qty: numQty,
      p_type: type,
      p_item_name: resolvedName,
      p_unit: resolvedUnit
    })

    if (error) {
      console.warn('[InventoryStockService] RPC increment failed, activating graceful fallback:', error.message)
      sentryLogger.logWarning(
        new Error(`[MES INVENTORY RPC DEGRADATION] rpc_increment_inventory_stock: ${error.message}`),
        { nomenclatureId, qty: numQty, type, errorCode: error.code }
      )
      return await executeFallbackIncrement({ nomenclatureId, qty: numQty, type, itemName: resolvedName, unit: resolvedUnit })
    }

    if (data?.success === false) {
      console.warn('[InventoryStockService] RPC rejected inventory increment:', data)
      return { success: false, viaRpc: true, data }
    }

    return {
      success: true,
      viaRpc: true,
      data
    }
  } catch (err) {
    console.warn('[InventoryStockService] RPC exception, running graceful fallback:', err)
    sentryLogger.logWarning(
      new Error(`[MES INVENTORY RPC EXCEPTION] ${err.message}`),
      { nomenclatureId, qty: numQty, type }
    )
    return await executeFallbackIncrement({ nomenclatureId, qty: numQty, type, itemName: resolvedName, unit: resolvedUnit })
  }
}

/**
 * Graceful fallback: Sequential client-side read + update/insert
 */
async function executeFallbackIncrement({ nomenclatureId, qty, type, itemName, unit }) {
  try {
    const { data: existing, error: lookupError } = await supabase
      .from('inventory')
      .select('id, total_qty')
      .eq('nomenclature_id', nomenclatureId)
      .eq('type', type)
      .limit(1)
      .maybeSingle()

    if (lookupError) throw lookupError

    if (existing) {
      const newTotal = (Number(existing.total_qty) || 0) + Number(qty)
      const { error: updateError } = await supabase
        .from('inventory')
        .update({
          total_qty: newTotal,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)

      if (updateError) throw updateError
      return { success: true, viaRpc: false, action: 'updated', newQty: newTotal }
    } else {
      const { data: inserted, error: insertError } = await supabase
        .from('inventory')
        .insert([{
          nomenclature_id: nomenclatureId,
          name: itemName || 'Деталь',
          unit: unit || 'шт',
          total_qty: Number(qty),
          type: type,
          warehouse: 'operational',
          updated_at: new Date().toISOString()
        }])
        .select('id, total_qty')
        .single()

      if (insertError) throw insertError
      return { success: true, viaRpc: false, action: 'inserted', newQty: Number(qty), id: inserted?.id }
    }
  } catch (fallbackErr) {
    console.error('[InventoryStockService] Fallback inventory increment failed:', fallbackErr)
    sentryLogger.logException(
      new Error(`[MES INVENTORY WRITE FAILURE] ${fallbackErr.message}`),
      { nomenclatureId, qty, type }
    )
    throw fallbackErr
  }
}

export default incrementInventoryStock
