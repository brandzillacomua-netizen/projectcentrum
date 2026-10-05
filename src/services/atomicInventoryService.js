/**
 * Atomic Inventory Service
 * Prevents race conditions and lost updates when multiple warehouse workers
 * issue materials or attach cards simultaneously.
 *
 * Uses PostgreSQL row-level locking (SELECT ... FOR UPDATE) via RPC
 * Rejects failed writes so callers cannot complete a document without its stock movement.
 */

export async function deductInventoryAtomic(supabase, {
  inventoryId,
  deductTotal = 0,
  releaseReserved = 0
}) {
  if (!supabase || !inventoryId) {
    throw new Error('supabase client and inventoryId are required');
  }

  const numDeduct = Number(deductTotal);
  const numRelease = Number(releaseReserved);
  if (!Number.isFinite(numDeduct) || !Number.isFinite(numRelease) || numDeduct < 0 || numRelease < 0) {
    throw new Error('Кількість списання та зняття резерву має бути невід’ємним числом');
  }

  // 1. Attempt server-side atomic RPC with row lock
  try {
    const { data, error } = await supabase.rpc('rpc_deduct_inventory_atomic', {
      p_inventory_id: inventoryId,
      p_deduct_total: numDeduct,
      p_release_reserved: numRelease
    });

    if (!error && data?.success === true) {
      return { success: true, data };
    }

    if (error) {
      console.error('[atomicInventoryService] RPC error (Fail-Closed):', error.message);
      throw error;
    }
    throw new Error(data?.error || 'Сервер не підтвердив списання. Оновіть дані перед повторною дією.');
  } catch (rpcErr) {
    console.error('[atomicInventoryService] RPC execution failed (Fail-Closed):', rpcErr);
    throw rpcErr;
  }
}
