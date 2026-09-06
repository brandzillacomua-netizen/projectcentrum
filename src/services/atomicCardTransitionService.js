/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: ATOMIC CARD TRANSITION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════
 * Executes work card status transitions and history entries as an atomic,
 * indivisible ACID transaction via PostgreSQL RPC `rpc_transition_work_card_atomic`.
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
 * Resolves a permanent hardware/browser-level device UUID that:
 * - Is generated once per tablet browser installation
 * - Stored in localStorage ('MES_DEVICE_ID')
 * - Survives page reloads, Wi-Fi reconnects, tab closing, and user logout
 */
export function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'server_instance';
  try {
    let deviceId = localStorage.getItem('MES_DEVICE_ID');
    if (!deviceId) {
      const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : (Math.random().toString(36).substring(2, 12) + '_' + Date.now().toString(36));
      deviceId = `dev_${randomPart}`;
      localStorage.setItem('MES_DEVICE_ID', deviceId);
    }
    return deviceId;
  } catch (e) {
    return 'fallback_device';
  }
}

/**
 * Execute an atomic transition on a work card
 * 
 * @param {Object} params
 * @param {string} params.cardId - Work card UUID
 * @param {Object} params.cardUpdate - Fields to update in work_cards
 * @param {Object} [params.historyData] - Fields to insert into work_card_history
 * @param {Function} [params.fallbackFn] - Fallback function if RPC is missing
 * @param {string} [params.idempotencyKey] - Unique transaction idempotency key
 * @param {string} [params.clientSession] - Session or terminal identifier
 * @param {boolean} [params.allowOfflineQueue=true] - Buffers to IndexedDB if offline or on network failure
 * @returns {Promise<{success: boolean, viaRpc: boolean, queued?: boolean, isOffline?: boolean, error?: any}>}
 */
export async function executeAtomicCardTransition({
  cardId,
  cardUpdate,
  historyData = null,
  fallbackFn = null,
  idempotencyKey = null,
  clientSession = null,
  allowOfflineQueue = true
}) {
  if (!cardId) {
    throw new Error('[AtomicCardTransition] Missing cardId');
  }

  const resolvedKey = idempotencyKey || historyData?.card_info?.match(/\[IDEMPOTENCY_KEY:([^\]]+)\]/)?.[1] || `trans_${cardId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const resolvedSession = clientSession || getOrCreateDeviceId();

  // 0. Pre-flight offline check: immediately buffer if browser is offline
  if (typeof navigator !== 'undefined' && !navigator.onLine && allowOfflineQueue) {
    console.info(`[AtomicCardTransition] Device is offline. Enqueueing transition for card ${cardId} (${resolvedKey})`);
    enqueueOfflineMutation({
      key: resolvedKey,
      actionType: 'TRANSITION_WORK_CARD',
      payload: {
        cardId,
        cardUpdate,
        historyData,
        clientSession: resolvedSession
      }
    });
    return {
      success: true,
      viaRpc: false,
      queued: true,
      isOffline: true,
      message: 'Збережено в чергу офлайн (немає зв’язку). Буде синхронізовано автоматично.'
    };
  }

  // 1. Primary path: Atomic Server RPC
  try {
    const { data, error } = await supabase.rpc('rpc_transition_work_card_atomic', {
      p_card_id: cardId,
      p_card_update: cardUpdate,
      p_history_data: historyData,
      p_idempotency_key: resolvedKey,
      p_client_session: resolvedSession
    });

    if (error) {
      if (allowOfflineQueue && isNetworkError(error)) {
        console.warn('[AtomicCardTransition] RPC network error. Enqueueing to offline queue:', error.message);
        enqueueOfflineMutation({
          key: resolvedKey,
          actionType: 'TRANSITION_WORK_CARD',
          payload: { cardId, cardUpdate, historyData, clientSession: resolvedSession }
        });
        return {
          success: true,
          viaRpc: false,
          queued: true,
          isOffline: true,
          message: 'Збережено в чергу офлайн (збій зв’язку). Буде синхронізовано автоматично.'
        };
      }

      // If function does not exist (code 42883) or server error, trigger fallback and LOUD ALERT
      console.warn('[AtomicCardTransition] RPC call failed, attempting graceful fallback:', error.message);
      if (fallbackFn) {
        try {
          sentryLogger.logException(
            new Error(`[MES RPC DEGRADATION] rpc_transition_work_card_atomic failed: ${error.message}`),
            { rpc: 'rpc_transition_work_card_atomic', cardId, errorCode: error.code, message: error.message }
          );
        } catch (alertErr) {
          console.warn('[AtomicCardTransition] Alerting error:', alertErr);
        }
        await fallbackFn();
        return { success: true, viaRpc: false };
      }
      throw error;
    }

    if (data?.success === false) {
      // Server rejected the transition (FSM conflict, already claimed, or illegal transition)
      console.warn('[AtomicCardTransition] Transition rejected by server FSM:', data);
      return {
        success: false,
        viaRpc: true,
        conflict: Boolean(data.conflict),
        alreadyClaimed: Boolean(data.already_claimed),
        illegalTransition: Boolean(data.illegal_transition),
        claimedBy: data.claimed_by,
        machine: data.machine,
        currentStatus: data.current_status,
        operation: data.operation,
        rpcVersion: data.rpc_version,
        message: data.message || 'Дію відхилено сервером',
        data
      };
    }

    if (data?.already_processed === true && data?.reason === 'idempotent_replay') {
      console.info('[AtomicCardTransition] Idempotent replay recognized:', cardId, resolvedKey);
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
      console.warn('[AtomicCardTransition] Network exception. Enqueueing to offline queue:', err.message);
      enqueueOfflineMutation({
        key: resolvedKey,
        actionType: 'TRANSITION_WORK_CARD',
        payload: { cardId, cardUpdate, historyData, clientSession: resolvedSession }
      });
      return {
        success: true,
        viaRpc: false,
        queued: true,
        isOffline: true,
        message: 'Збережено в чергу офлайн (збій зв’язку). Буде синхронізовано автоматично.'
      };
    }

    // 2. Secondary path: Graceful Fallback with Precondition Idempotency Check
    if (fallbackFn) {
      console.info('[AtomicCardTransition] Executing graceful fallback sequence for card:', cardId);
      try {
        sentryLogger.logException(
          new Error(`[MES RPC UNHANDLED EXCEPTION] rpc_transition_work_card_atomic threw: ${err.message}`),
          { rpc: 'rpc_transition_work_card_atomic', cardId, error: err }
        );
      } catch (alertErr) {
        console.warn('[AtomicCardTransition] Alerting error:', alertErr);
      }
      try {
        // Guard against duplicate execution in fallback mode
        const { data: freshCard } = await supabase
          .from('work_cards')
          .select('status, operation')
          .eq('id', cardId)
          .maybeSingle();

        if (freshCard && freshCard.status === cardUpdate?.status && freshCard.operation === cardUpdate?.operation) {
          console.info('[AtomicCardTransition Fallback] Card already transitioned by concurrent session');
          return { success: true, viaRpc: false, alreadyProcessed: true };
        }
      } catch (checkErr) {
        console.warn('[AtomicCardTransition Fallback] Precondition check non-fatal error:', checkErr);
      }

      try {
        await fallbackFn();
        return { success: true, viaRpc: false };
      } catch (fbErr) {
        if (allowOfflineQueue && isNetworkError(fbErr)) {
          enqueueOfflineMutation({
            key: resolvedKey,
            actionType: 'TRANSITION_WORK_CARD',
            payload: { cardId, cardUpdate, historyData, clientSession: resolvedSession }
          });
          return {
            success: true,
            viaRpc: false,
            queued: true,
            isOffline: true,
            message: 'Збережено в чергу офлайн (збій зв’язку). Буде синхронізовано автоматично.'
          };
        }
        throw fbErr;
      }
    }
    throw err;
  }
}

export default executeAtomicCardTransition;

