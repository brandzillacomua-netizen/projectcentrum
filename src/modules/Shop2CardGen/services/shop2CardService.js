import { supabase } from '../../../supabase'

/**
 * Service to handle database operations for Shop 2 Buffer and Work Card Generation
 */
export const shop2CardService = {
  /**
   * Fetch active work cards for Shop 2 tasks
   */
  async fetchShop2WorkCards(shop2TaskIds = []) {
    if (!shop2TaskIds || shop2TaskIds.length === 0) return []
    const { data, error } = await supabase
      .from('work_cards')
      .select('*')
      .in('task_id', shop2TaskIds)
    if (error) {
      console.error('[shop2CardService] Error fetching Shop 2 work cards:', error)
      throw error
    }
    return (data || []).map(c => {
      const sheetsMatch = c.card_info?.match(/\[SHEETS:(\d+)\]/)
      const bzMatch = c.card_info?.match(/\[BZ:(\d+)\]/)
      return {
        ...c,
        actual_sheets: sheetsMatch ? Number(sheetsMatch[1]) : (c.actual_sheets || 0),
        actualSheets: sheetsMatch ? Number(sheetsMatch[1]) : (c.actual_sheets || 0),
        buffer_qty: bzMatch ? Number(bzMatch[1]) : (c.buffer_qty || 0),
        bufferQty: bzMatch ? Number(bzMatch[1]) : (c.buffer_qty || 0)
      }
    })
  },

  /**
   * Submit batch creation of Shop 2 work cards and deduct quantity from source buffer cards
   * Uses atomic PostgreSQL RPC transaction with fallback
   */
  async createShop2CardsBatch({ taskId, orderId, nomenclatureId, cardsBatch, userId = null }) {
    if (!cardsBatch || cardsBatch.length === 0) return []

    const insertPayloads = cardsBatch.map(item => {
      const sheets = item.actualSheets || item.sheets || 0
      const bz = item.bufferQty || 0
      let cardInfo = String(item.cardInfo || '')
      if (sheets > 0 && !cardInfo.includes('[SHEETS:')) {
        cardInfo = `${cardInfo} [SHEETS:${sheets}]`.trim()
      }
      if (bz > 0 && !cardInfo.includes('[BZ:')) {
        cardInfo = `${cardInfo} [BZ:${bz}]`.trim()
      }

      return {
        task_id: taskId,
        order_id: orderId,
        nomenclature_id: nomenclatureId,
        operation: item.operation || 'Пресування',
        machine: item.machine || 'Не вказано',
        quantity: item.quantity,
        card_info: cardInfo,
        status: item.status || 'new',
        is_rework: Boolean(item.is_rework)
      }
    })

    const totalQtyToDeduct = cardsBatch.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)

    // ── ATOMIC ENTERPRISE RPC EXECUTION ──────────────────────────────────────────
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_generate_shop2_cards_atomic', {
        p_order_id: orderId || null,
        p_nomenclature_id: nomenclatureId,
        p_cards_payload: insertPayloads,
        p_total_qty_to_deduct: totalQtyToDeduct,
        p_user_id: userId || 'Майстер Цеху №2'
      })

      if (!rpcErr && rpcRes?.success) {
        return (rpcRes.cards || []).map(c => {
          const sheetsMatch = c.card_info?.match(/\[SHEETS:(\d+)\]/)
          const bzMatch = c.card_info?.match(/\[BZ:(\d+)\]/)
          return {
            ...c,
            actual_sheets: sheetsMatch ? Number(sheetsMatch[1]) : 0,
            actualSheets: sheetsMatch ? Number(sheetsMatch[1]) : 0,
            buffer_qty: bzMatch ? Number(bzMatch[1]) : 0,
            bufferQty: bzMatch ? Number(bzMatch[1]) : 0
          }
        })
      }

      if (rpcRes && !rpcRes.success && rpcRes.conflict) {
        throw new Error(rpcRes.error || 'Недостатньо вільних заготовок у буфері')
      }
    } catch (rpcEx) {
      if (rpcEx.message && rpcEx.message.includes('Недостатньо')) {
        throw rpcEx
      }
      console.warn('[shop2CardService] RPC unavailable or error, falling back to direct operations:', rpcEx?.message)
    }

    // ── FALLBACK DIRECT EXECUTION (Zero-downtime safety) ──────────────────────────
    // 1. Insert new Shop 2 cards
    const { data, error } = await supabase
      .from('work_cards')
      .insert(insertPayloads)
      .select('*')

    if (error) {
      console.error('[shop2CardService] Error creating Shop 2 work cards batch:', error)
      throw error
    }

    // 2. Deduct from source buffer cards (update used_in_shop2_qty)
    if (totalQtyToDeduct > 0) {
      await this.deductFromSourceBufferCards({ orderId, nomenclatureId, totalQtyToDeduct })
    }

    return (data || []).map(c => {
      const sheetsMatch = c.card_info?.match(/\[SHEETS:(\d+)\]/)
      const bzMatch = c.card_info?.match(/\[BZ:(\d+)\]/)
      return {
        ...c,
        actual_sheets: sheetsMatch ? Number(sheetsMatch[1]) : 0,
        actualSheets: sheetsMatch ? Number(sheetsMatch[1]) : 0,
        buffer_qty: bzMatch ? Number(bzMatch[1]) : 0,
        bufferQty: bzMatch ? Number(bzMatch[1]) : 0
      }
    })
  },

  /**
   * Fetch backend-aggregated material ledger summary for Shop 2
   */
  async fetchShop2BufferSummary(orderIds = null) {
    try {
      const { data, error } = await supabase.rpc('rpc_get_shop2_buffer_summary', {
        p_order_ids: orderIds && orderIds.length > 0 ? orderIds : null
      })
      if (error) {
        console.warn('[shop2CardService] fetchShop2BufferSummary RPC error:', error?.message)
        return null
      }
      return data || []
    } catch (err) {
      console.warn('[shop2CardService] fetchShop2BufferSummary failed:', err?.message)
      return null
    }
  },

  /**
   * Deduct buffer quantity from matching Shop 1 source buffer cards
   */
  async deductFromSourceBufferCards({ orderId, nomenclatureId, totalQtyToDeduct }) {
    try {
      let query = supabase
        .from('work_cards')
        .select('id, quantity, used_in_shop2_qty, status, is_rework')
        .eq('nomenclature_id', nomenclatureId)

      if (orderId) {
        query = query.eq('order_id', orderId)
      }

      const { data: sourceCards, error } = await query
      if (error || !sourceCards) return

      // Filter buffer cards
      const bufferCards = sourceCards.filter(c => c.status === 'at-shop2-buffer' || c.is_rework)

      let remainingDeduction = totalQtyToDeduct
      for (const card of bufferCards) {
        if (remainingDeduction <= 0) break
        const currentQty = Number(card.quantity || 0)
        const currentUsed = Number(card.used_in_shop2_qty || 0)
        const avail = Math.max(0, currentQty - currentUsed)

        if (avail > 0) {
          const deductAmount = Math.min(avail, remainingDeduction)
          const newUsed = currentUsed + deductAmount

          await supabase
            .from('work_cards')
            .update({ used_in_shop2_qty: newUsed })
            .eq('id', card.id)

          remainingDeduction -= deductAmount
        }
      }
    } catch (err) {
      console.error('[shop2CardService] Buffer deduction error:', err)
    }
  }
}
