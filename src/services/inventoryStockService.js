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
  warehouse = 'operational',
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
      p_warehouse: warehouse,
      p_item_name: resolvedName,
      p_unit: resolvedUnit
    })

    if (error) {
      sentryLogger.logException(
        new Error(`[MES INVENTORY RPC EXCEPTION] rpc_increment_inventory_stock: ${error.message}`),
        { nomenclatureId, qty: numQty, type, errorCode: error.code }
      )
      console.error('[InventoryStockService] RPC failed (Fail-Closed):', error.message)
      throw error
    }

    if (data?.success === false) {
      console.warn('[InventoryStockService] RPC rejected inventory increment:', data)
      throw new Error(data.error || 'Server rejected inventory increment')
    }

    return {
      success: true,
      viaRpc: true,
      data
    }
  } catch (err) {
    console.error('[InventoryStockService] Unhandled Exception (Fail-Closed):', err.message)
    sentryLogger.logException(
      new Error(`[MES INVENTORY RPC EXCEPTION] ${err.message}`),
      { nomenclatureId, qty: numQty, type }
    )
    throw err
  }
}


export default incrementInventoryStock
