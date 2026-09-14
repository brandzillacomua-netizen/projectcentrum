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
      console.error('[atomicInventoryService] RPC error (Fail-Closed):', error.message);
      return { success: false, error };
    }
  } catch (rpcErr) {
    console.error('[atomicInventoryService] RPC execution failed (Fail-Closed):', rpcErr);
    return { success: false, error: rpcErr };
  }
}
