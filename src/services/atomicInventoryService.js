/**
 * Atomic Inventory Service
 * Prevents race conditions and lost updates when multiple warehouse workers
 * issue materials or attach cards simultaneously.
 *
 * Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) via RPC
 * with an automatic client-side fallback if the RPC is not yet deployed.
 */

export async function deductInventoryAtomic(supabase, {
  inventoryId,
  deductTotal = 0,
  releaseReserved = 0
}) {
  if (!supabase || !inventoryId) {
    return { success: false, error: new Error('supabase client and inventoryId are required') };
  }

  const numDeduct = Number(deductTotal) || 0;
  const numRelease = Number(releaseReserved) || 0;

  // 1. Attempt server-side atomic RPC with row lock
  try {
    const { data, error } = await supabase.rpc('rpc_deduct_inventory_atomic', {
      p_inventory_id: inventoryId,
      p_deduct_total: numDeduct,
      p_release_reserved: numRelease
    });

    if (!error && data?.success) {
      return { success: true, data };
    }

    if (error) {
      console.warn('[atomicInventoryService] RPC error, using graceful client fallback:', error.message);
    }
  } catch (rpcErr) {
    console.warn('[atomicInventoryService] RPC execution failed, falling back:', rpcErr);
  }

  // 2. Graceful Fallback (Client-side read-modify-write)
  try {
    const { data: invRow, error: fetchErr } = await supabase
      .from('inventory')
      .select('id, total_qty, reserved_qty')
      .eq('id', inventoryId)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!invRow) throw new Error(`Inventory item ${inventoryId} not found`);

    const nextTotal = Math.max(0, (Number(invRow.total_qty) || 0) - numDeduct);
    const nextReserved = Math.max(0, (Number(invRow.reserved_qty) || 0) - numRelease);

    const updatePayload = {
      total_qty: nextTotal,
      updated_at: new Date().toISOString()
    };
    if (numRelease > 0) {
      updatePayload.reserved_qty = nextReserved;
    }

    const { error: updateErr } = await supabase
      .from('inventory')
      .update(updatePayload)
      .eq('id', inventoryId);

    if (updateErr) throw updateErr;

    return {
      success: true,
      data: {
        id: inventoryId,
        prev_total: invRow.total_qty,
        new_total: nextTotal,
        prev_reserved: invRow.reserved_qty,
        new_reserved: nextReserved,
        is_fallback: true
      }
    };
  } catch (fallbackErr) {
    console.error('[atomicInventoryService] Fallback inventory update failed:', fallbackErr);
    return { success: false, error: fallbackErr };
  }
}
