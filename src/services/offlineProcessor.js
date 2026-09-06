import { supabase } from '../supabase.js'
import { executeAtomicCardTransition } from './atomicCardTransitionService.js'
import { executeAtomicQcScrap } from './atomicQcScrapService.js'
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
        allowOfflineQueue: false,
        fallbackFn: async () => {
          const { error } = await supabase.from('work_cards').update(updateData).eq('id', cardId)
          if (error) throw error
        }
      })

      if (transitionResult?.conflict) {
        console.warn(`[OfflineProcessor] Conflict detected on START_WORK_CARD replay for card ${cardId}:`, transitionResult)
        sentryLogger.logWarning(
          new Error(`[OFFLINE REPLAY CONFLICT] START_WORK_CARD rejected: ${transitionResult.message}`),
          { cardId, transitionResult, item }
        )
        // Card was modified while offline; resolve item to avoid jamming the offline queue
        return { success: true, conflict: true, warning: transitionResult.message }
      }
      return { success: true }
    }

    case 'COMPLETE_WORK_CARD': {
      const { cardId, updateData } = payload
      const transitionResult = await executeAtomicCardTransition({
        cardId,
        cardUpdate: updateData,
        idempotencyKey: item.key || null,
        allowOfflineQueue: false,
        fallbackFn: async () => {
          const { error } = await supabase.from('work_cards').update(updateData).eq('id', cardId)
          if (error) throw error
        }
      })

      if (transitionResult?.conflict) {
        console.warn(`[OfflineProcessor] Conflict detected on COMPLETE_WORK_CARD replay for card ${cardId}:`, transitionResult)
        sentryLogger.logWarning(
          new Error(`[OFFLINE REPLAY CONFLICT] COMPLETE_WORK_CARD rejected: ${transitionResult.message}`),
          { cardId, transitionResult, item }
        )
        return { success: true, conflict: true, warning: transitionResult.message }
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
        allowOfflineQueue: false,
        fallbackFn: async () => {
          if (historyData) {
            const { error: histErr } = await supabase.from('work_card_history').insert([historyData])
            if (histErr) console.warn('[OfflineProcessor] History insert warning:', histErr)
          }
          if (cardUpdate) {
            const { error: cardErr } = await supabase.from('work_cards').update(cardUpdate).eq('id', cardId)
            if (cardErr) throw cardErr
          }
        }
      })

      if (transitionResult?.conflict) {
        console.warn(`[OfflineProcessor] Conflict detected on TRANSITION_WORK_CARD replay for card ${cardId}:`, transitionResult)
        sentryLogger.logWarning(
          new Error(`[OFFLINE REPLAY CONFLICT] TRANSITION_WORK_CARD rejected: ${transitionResult.message}`),
          { cardId, transitionResult, item }
        )
        return { success: true, conflict: true, warning: transitionResult.message }
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

      // ── Step 1: Try atomic PostgreSQL RPC with idempotency key ────────────
      try {
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
        if (!rpcErr && rpcRes?.success !== false) {
          return { success: true }
        }
      } catch (e) {
        console.warn('[OfflineProcessor] RPC confirm buffer failed, falling back to legacy writes:', e)
      }

      // ── Step 2: Legacy fallback if RPC not active ─────────────────────────
      if (historyData) {
        const { error: histErr } = await supabase.from('work_card_history').insert([historyData])
        if (histErr) console.warn('[OfflineProcessor] History insert warning:', histErr)
      }
      if (cardUpdate) {
        const { error: cardErr } = await supabase.from('work_cards').update(cardUpdate).eq('id', cardId)
        if (cardErr) throw cardErr
      }
      if (totalScrap > 0 && cardNomId) {
        await incrementInventoryStock({
          nomenclatureId: cardNomId,
          qty: totalScrap,
          type: 'scrap_ready',
          itemName: nomName || 'Деталь',
          unit: nomUnit || 'шт'
        }).catch(err => {
          console.warn('[OfflineProcessor] Scrap increment fallback warning:', err)
        })
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
      console.warn(`[OfflineProcessor] Unknown actionType: ${actionType}`)
      return { success: true }
  }
}
