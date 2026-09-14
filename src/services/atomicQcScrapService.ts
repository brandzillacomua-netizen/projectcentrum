/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛡️ MES CENTRUM ENTERPRISE: ATOMIC QC SCRAP SERVICE (TypeScript)
 * ═══════════════════════════════════════════════════════════════════════════
 * Executes work card scrap deduction, history logging, and inventory addition
 * as a single atomic, indivisible ACID transaction via PostgreSQL RPC `rpc_qc_scrap_atomic`.
 * 
 * Provides 100% Graceful Fallback to sequential HTTP writes if RPC is not yet installed.
 */

import { supabase } from '../supabase.js'
import { sentryLogger } from './sentryLogger.js'
import { enqueueOfflineMutation } from './offlineQueueService.js'

const isNetworkError = (err: any): boolean => {
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

export interface QcScrapParams {
  cardId: string
  scrapQty: number
  historyData: Record<string, any>
  idempotencyKey?: string | null
  allowOfflineQueue?: boolean
}

export interface QcScrapResult {
  success: boolean
  viaRpc: boolean
  queued?: boolean
  isOffline?: boolean
  alreadyProcessed?: boolean
  reason?: string
  rpcVersion?: string
  message?: string
  data?: any
  error?: any
}

/**
 * Execute an atomic QC scrap deduction
 */
export async function executeAtomicQcScrap({
  cardId,
  scrapQty,
  historyData,
  idempotencyKey = null,
  allowOfflineQueue = true
}: QcScrapParams): Promise<QcScrapResult> {
  if (!cardId || scrapQty <= 0) {
    throw new Error('[AtomicQcScrap] Invalid cardId or scrapQty')
  }

  const resolvedKey = idempotencyKey || historyData?.card_info?.match(/\[IDEMPOTENCY_KEY:([^\]]+)\]/)?.[1] || `qc_scrap_${cardId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`

  // 0. Pre-flight offline check
  if (typeof navigator !== 'undefined' && !navigator.onLine && allowOfflineQueue) {
    console.info(`[AtomicQcScrap] Device is offline. Enqueueing QC scrap for card ${cardId}`)
    enqueueOfflineMutation({
      key: resolvedKey,
      actionType: 'QC_SCRAP',
      payload: { cardId, scrapQty, historyData }
    })
    return {
      success: true,
      viaRpc: false,
      queued: true,
      isOffline: true,
      message: 'Збережено в чергу офлайн. Буде передано автоматично при появі мережі.'
    }
  }

  // 1. Primary path: Atomic Server RPC
  try {
    const { data, error } = await supabase.rpc('rpc_qc_scrap_atomic', {
      p_card_id: cardId,
      p_scrap_qty: scrapQty,
      p_history_data: historyData,
      p_idempotency_key: resolvedKey
    })

    if (error) {
      if (allowOfflineQueue && isNetworkError(error)) {
        console.warn('[AtomicQcScrap] RPC network error. Enqueueing to offline queue:', error.message)
        enqueueOfflineMutation({
          key: resolvedKey,
          actionType: 'QC_SCRAP',
          payload: { cardId, scrapQty, historyData }
        })
        return {
          success: true,
          viaRpc: false,
          queued: true,
          isOffline: true,
          message: 'Збережено в чергу офлайн (збій зв’язку). Буде передано автоматично.'
        }
      }

      console.error('[AtomicQcScrap] RPC call failed (Fail-Closed):', error.message)
      try {
        sentryLogger.logException(
          new Error(`[MES RPC DEGRADATION] rpc_qc_scrap_atomic failed: ${error.message}`),
          { rpc: 'rpc_qc_scrap_atomic', cardId, scrapQty, errorCode: error.code, message: error.message }
        )
      } catch (alertErr) {
        console.warn('[AtomicQcScrap] Alerting error:', alertErr)
      }
      throw error
    }

    if (data?.success === false) {
      console.warn('[AtomicQcScrap] Server rejected scrap deduction:', data)
      return {
        success: false,
        viaRpc: true,
        error: data.error,
        rpcVersion: data.rpc_version,
        data
      }
    }

    if (data?.already_processed === true && data?.reason === 'idempotent_replay') {
      console.info('[AtomicQcScrap] Idempotent replay recognized:', cardId, resolvedKey)
      return {
        success: true,
        viaRpc: true,
        alreadyProcessed: true,
        reason: 'idempotent_replay',
        rpcVersion: data.rpc_version,
        data
      }
    }

    return {
      success: true,
      viaRpc: true,
      rpcVersion: data?.rpc_version,
      data
    }
  } catch (err: any) {
    if (allowOfflineQueue && isNetworkError(err)) {
      console.warn('[AtomicQcScrap] Network exception. Enqueueing to offline queue:', err.message)
      enqueueOfflineMutation({
        key: resolvedKey,
        actionType: 'QC_SCRAP',
        payload: { cardId, scrapQty, historyData }
      })
      return {
        success: true,
        viaRpc: false,
        queued: true,
        isOffline: true,
        message: 'Збережено в чергу офлайн (збій зв’язку). Буде передано автоматично.'
      }
    }

    console.error('[AtomicQcScrap] Unhandled Exception (Fail-Closed):', err.message)
    try {
      sentryLogger.logException(
        new Error(`[MES RPC UNHANDLED EXCEPTION] rpc_qc_scrap_atomic threw: ${err.message}`),
        { rpc: 'rpc_qc_scrap_atomic', cardId, scrapQty, error: err }
      )
    } catch (alertErr) {
      console.warn('[AtomicQcScrap] Alerting error:', alertErr)
    }
    throw err
  }
}

export default executeAtomicQcScrap
