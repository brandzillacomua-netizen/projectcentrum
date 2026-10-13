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

/**
 * Idempotent cutting consumption. The database uses cardId + consumptionKey
 * as a receipt key, so retries and double clicks cannot deduct stock twice.
 * Material-request reservation balances are updated in the same transaction.
 */
export async function consumeCuttingInventoryOnce(supabase, {
  cardId,
  consumptionKey,
  inventoryId,
  deductTotal = 0,
  releaseReserved = 0,
  requestAllocations = []
}) {
  if (!supabase || !cardId || !consumptionKey || !inventoryId) {
    throw new Error('cardId, consumptionKey та inventoryId обов’язкові для списання розкрою')
  }

  const numDeduct = Number(deductTotal)
  const numRelease = Number(releaseReserved)
  if (!Number.isFinite(numDeduct) || !Number.isFinite(numRelease) || numDeduct < 0 || numRelease < 0) {
    throw new Error('Некоректна кількість списання матеріалів розкрою')
  }

  const { data, error } = await supabase.rpc('rpc_consume_cutting_inventory_once', {
    p_card_id: cardId,
    p_consumption_key: String(consumptionKey),
    p_inventory_id: inventoryId,
    p_deduct_total: numDeduct,
    p_release_reserved: numRelease,
    p_request_allocations: requestAllocations
  })

  if (error) {
    const isMissingFunction = error.code === 'PGRST202' ||
      String(error.message || '').includes('rpc_consume_cutting_inventory_once')
    if (isMissingFunction) {
      throw new Error('У production-базі ще не встановлено захищене списання розкрою. Картку не завершено і матеріали не списано. Зверніться до адміністратора для застосування міграції 20261012190000.')
    }
    throw error
  }
  if (!data?.success) throw new Error(data?.error || 'Сервер не підтвердив списання матеріалів розкрою')
  return data
}

export function buildRequestAllocations(requests = [], quantity = 0) {
  let remaining = Math.max(0, Number(quantity) || 0)
  const allocations = []

  for (const request of requests) {
    if (remaining <= 0) break
    const available = Math.max(0, Number(request?.quantity) || 0)
    const allocated = Math.min(available, remaining)
    if (request?.id && allocated > 0) {
      allocations.push({ id: request.id, quantity: allocated })
      remaining -= allocated
    }
  }

  return allocations
}
