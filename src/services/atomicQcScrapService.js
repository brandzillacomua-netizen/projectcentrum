/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: ATOMIC QC SCRAP SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 * Executes work card scrap deduction, history logging, and inventory addition
 * as a single atomic, indivisible ACID transaction via PostgreSQL RPC `rpc_qc_scrap_atomic`.
 * 
 * Provides 100% Graceful Fallback to sequential HTTP writes if RPC is not yet installed.
 */

import { supabase } from '../supabase.js'
import { sentryLogger } from './sentryLogger.js'
import { enqueueOfflineMutation } from './offlineQueueService.js'

const isNetworkError = (err) => {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (!err) return false
  const msg = String(err.message || '').toLowerCase()
  const name = String(err.name || '').toLowerCase()
  return (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('load failed') ||
    name === 'typeerror' ||
    err.status === 0 ||
    err.code === 'PGRST000'
  )
}

/**
 * Execute an atomic QC scrap deduction
 * 
 * @param {Object} params
 * @param {string} params.cardId - Work card UUID
 * @param {number} params.scrapQty - Scrap quantity to deduct
 * @param {Object} params.historyData - Fields to insert into work_card_history
 * @param {string} [params.idempotencyKey] - Idempotency key
 * @param {Function} [params.fallbackFn] - Fallback function if RPC is missing
 * @param {boolean} [params.allowOfflineQueue=true] - Buffers to IndexedDB if offline or on network failure
 * @returns {Promise<{success: boolean, viaRpc: boolean, queued?: boolean, isOffline?: boolean, data?: any, error?: any}>}
 */
export async function executeAtomicQcScrap({
  cardId,
  scrapQty,
  historyData,
  idempotencyKey = null,
  fallbackFn = null,
  allowOfflineQueue = true
}) {
  if (!cardId || scrapQty <= 0) {
    throw new Error('[AtomicQcScrap] Invalid cardId or scrapQty');
  }

  const resolvedKey = idempotencyKey || historyData?.card_info?.match(/\[IDEMPOTENCY_KEY:([^\]]+)\]/)?.[1] || `qc_scrap_${cardId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // 0. Pre-flight offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine && allowOfflineQueue) {
    console.info(`[AtomicQcScrap] Device is offline. Enqueueing QC scrap for card ${cardId}`);
    enqueueOfflineMutation({
      key: resolvedKey,
      actionType: 'QC_SCRAP',
      payload: { cardId, scrapQty, historyData }
    });
    return {
      success: true,
      viaRpc: false,
      queued: true,
      isOffline: true,
      message: 'Збережено в чергу офлайн. Буде передано автоматично при появі мережі.'
    };
  }

  // 1. Primary path: Atomic Server RPC
  try {
    const { data, error } = await supabase.rpc('rpc_qc_scrap_atomic', {
      p_card_id: cardId,
      p_scrap_qty: scrapQty,
      p_history_data: historyData,
      p_idempotency_key: resolvedKey
    });

    if (error) {
      if (allowOfflineQueue && isNetworkError(error)) {
        console.warn('[AtomicQcScrap] RPC network error. Enqueueing to offline queue:', error.message);
        enqueueOfflineMutation({
          key: resolvedKey,
          actionType: 'QC_SCRAP',
          payload: { cardId, scrapQty, historyData }
        });
        return {
          success: true,
          viaRpc: false,
          queued: true,
          isOffline: true,
          message: 'Збережено в чергу офлайн (збій зв’язку). Буде передано автоматично.'
        };
      }

      console.warn('[AtomicQcScrap] RPC call failed, attempting graceful fallback:', error.message);
      if (fallbackFn) {
        try {
          sentryLogger.logException(
            new Error(`[MES RPC DEGRADATION] rpc_qc_scrap_atomic failed: ${error.message}`),
            { rpc: 'rpc_qc_scrap_atomic', cardId, scrapQty, errorCode: error.code, message: error.message }
          );
        } catch (alertErr) {
          console.warn('[AtomicQcScrap] Alerting error:', alertErr);
        }
        await fallbackFn();
        return { success: true, viaRpc: false };
      }
      throw error;
    }

    if (data?.success === false) {
      console.warn('[AtomicQcScrap] Server rejected scrap deduction:', data);
      return {
        success: false,
        viaRpc: true,
        error: data.error,
        rpcVersion: data.rpc_version,
        data
      };
    }

    if (data?.already_processed === true && data?.reason === 'idempotent_replay') {
      console.info('[AtomicQcScrap] Idempotent replay recognized:', cardId, resolvedKey);
      return {
        success: true,
        viaRpc: true,
        alreadyProcessed: true,
        reason: 'idempotent_replay',
        rpcVersion: data.rpc_version,
        data
      };
    }

    return {
      success: true,
      viaRpc: true,
      rpcVersion: data?.rpc_version,
      data
    };
  } catch (err) {
    if (allowOfflineQueue && isNetworkError(err)) {
      console.warn('[AtomicQcScrap] Network exception. Enqueueing to offline queue:', err.message);
      enqueueOfflineMutation({
        key: resolvedKey,
        actionType: 'QC_SCRAP',
        payload: { cardId, scrapQty, historyData }
      });
      return {
        success: true,
        viaRpc: false,
        queued: true,
        isOffline: true,
        message: 'Збережено в чергу офлайн (збій зв’язку). Буде передано автоматично.'
      };
    }

    // 2. Secondary path: Graceful Fallback
    if (fallbackFn) {
      console.info('[AtomicQcScrap] Executing graceful fallback sequence for card:', cardId);
      try {
        sentryLogger.logException(
          new Error(`[MES RPC UNHANDLED EXCEPTION] rpc_qc_scrap_atomic threw: ${err.message}`),
          { rpc: 'rpc_qc_scrap_atomic', cardId, scrapQty, error: err }
        );
      } catch (alertErr) {
        console.warn('[AtomicQcScrap] Alerting error:', alertErr);
      }
      try {
        await fallbackFn();
        return { success: true, viaRpc: false };
      } catch (fbErr) {
        if (allowOfflineQueue && isNetworkError(fbErr)) {
          enqueueOfflineMutation({
            key: resolvedKey,
            actionType: 'QC_SCRAP',
            payload: { cardId, scrapQty, historyData }
          });
          return {
            success: true,
            viaRpc: false,
            queued: true,
            isOffline: true,
            message: 'Збережено в чергу офлайн (збій зв’язку). Буде передано автоматично.'
          };
        }
        throw fbErr;
      }
    }
    throw err;
  }
}

export default executeAtomicQcScrap;

