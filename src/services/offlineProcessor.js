import { supabase } from '../supabase.js'
import { executeAtomicCardTransition } from './atomicCardTransitionService'
import { executeAtomicQcScrap } from './atomicQcScrapService'
import { incrementInventoryStock } from './inventoryStockService.js'
import { sentryLogger } from './sentryLogger.js'

/**
 * Processes a single enqueued offline mutation when connectivity is restored.
 */
export const processOfflineMutation = async (item) => {
  const { actionType, payload } = item
  console.info(`[OfflineProcessor] Replaying mutation: ${actionType}`, payload)

  switch (actionType) {
    case 'START_WORK_CARD': {
      const { cardId, updateData } = payload
      const transitionResult = await executeAtomicCardTransition({
        cardId,
        cardUpdate: updateData,
        idempotencyKey: item.key || null,
        allowOfflineQueue: false
      })

      if (transitionResult?.conflict) {
        console.warn(`[OfflineProcessor] Conflict detected on START_WORK_CARD replay for card ${cardId}:`, transitionResult)
        sentryLogger.logWarning(
          new Error(`[OFFLINE REPLAY CONFLICT] START_WORK_CARD rejected: ${transitionResult.message}`),
          { cardId, transitionResult, item }
        )
        // Throw error to route item to Dead-Letter Queue / Reconciliation Inbox
        throw new Error(`[OFFLINE_CONFLICT] ${transitionResult.message || 'Сортування/перехід відхилено через новий стан на сервері'}`)
      }
      return { success: true }
    }

    case 'COMPLETE_WORK_CARD': {
      const { cardId, updateData } = payload
      const transitionResult = await executeAtomicCardTransition({
        cardId,
        cardUpdate: updateData,
        idempotencyKey: item.key || null,
        allowOfflineQueue: false
      })

      if (transitionResult?.conflict) {
        console.warn(`[OfflineProcessor] Conflict detected on COMPLETE_WORK_CARD replay for card ${cardId}:`, transitionResult)
        sentryLogger.logWarning(
          new Error(`[OFFLINE REPLAY CONFLICT] COMPLETE_WORK_CARD rejected: ${transitionResult.message}`),
          { cardId, transitionResult, item }
        )
        throw new Error(`[OFFLINE_CONFLICT] ${transitionResult.message || 'Сортування/завершення відхилено через новий стан на сервері'}`)
      }
      return { success: true }
    }

    case 'TRANSITION_WORK_CARD': {
      const { cardId, cardUpdate, historyData, clientSession } = payload
      const transitionResult = await executeAtomicCardTransition({
        cardId,
        cardUpdate,
        historyData,
        clientSession,
        idempotencyKey: item.key || null,
        allowOfflineQueue: false
      })

      if (transitionResult?.conflict) {
        console.warn(`[OfflineProcessor] Conflict detected on TRANSITION_WORK_CARD replay for card ${cardId}:`, transitionResult)
        sentryLogger.logWarning(
          new Error(`[OFFLINE REPLAY CONFLICT] TRANSITION_WORK_CARD rejected: ${transitionResult.message}`),
          { cardId, transitionResult, item }
        )
        throw new Error(`[OFFLINE_CONFLICT] ${transitionResult.message || 'Перехід картки відхилено через новий стан на сервері'}`)
      }
      return { success: true }
    }

    case 'QC_SCRAP': {
      const { cardId, scrapQty, historyData } = payload
      const scrapResult = await executeAtomicQcScrap({
        cardId,
        scrapQty,
        historyData,
        idempotencyKey: item.key || null,
        allowOfflineQueue: false
      })
      return { success: true, scrapResult }
    }

    case 'INCREMENT_INVENTORY': {
      await incrementInventoryStock(payload)
      return { success: true }
    }

    case 'CONFIRM_BUFFER': {
      const { cardId, cardUpdate, historyData, totalScrap, cardNomId, nomName, nomUnit } = payload

      // ── Try atomic PostgreSQL RPC with idempotency key ────────────
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_confirm_buffer_atomic', {
        p_card_id: cardId,
        p_card_update: cardUpdate,
        p_history_data: historyData,
        p_total_scrap: totalScrap || 0,
        p_nomenclature_id: cardNomId || null,
        p_scrap_item_name: nomName || 'Деталь',
        p_scrap_unit: nomUnit || 'шт',
        p_idempotency_key: item.key || null
      })
      if (rpcErr) throw rpcErr
      if (rpcRes?.success === false) {
        throw new Error(rpcRes.error || 'Server rejected buffer confirmation')
      }
      return { success: true }
    }

    case 'CREATE_WORK_CARD': {
      const { cardData } = payload
      const { error } = await supabase.from('work_cards').insert([cardData])
      if (error) throw error
      return { success: true }
    }

    case 'CREATE_WORK_CARDS_BATCH': {
      const { payloads } = payload
      const { error } = await supabase.from('work_cards').insert(payloads)
      if (error) throw error
      return { success: true }
    }

    default:
      console.error(`[OfflineProcessor] Unknown actionType (Dead Letter): ${actionType}`)
      throw new Error(`[UNKNOWN_ACTION] Unknown offline actionType: ${actionType}`)
  }
}
