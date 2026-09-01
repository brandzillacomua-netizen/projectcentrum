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
    return data || []
  },

  /**
   * Submit batch creation of Shop 2 work cards and deduct quantity from source buffer cards
   */
  async createShop2CardsBatch({ taskId, orderId, nomenclatureId, cardsBatch }) {
    if (!cardsBatch || cardsBatch.length === 0) return []

    const insertPayloads = cardsBatch.map(item => ({
      task_id: taskId,
      order_id: orderId,
      nomenclature_id: nomenclatureId,
      operation: item.operation || 'Пресування',
      machine: item.machine || 'Не вказано',
      quantity: item.quantity,
      actual_sheets: item.actualSheets || item.sheets || 0,
      buffer_qty: item.bufferQty || 0,
      card_info: item.cardInfo || '',
      status: item.status || 'new',
      is_rework: Boolean(item.is_rework)
    }))

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
    const totalQtyToDeduct = cardsBatch.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    if (totalQtyToDeduct > 0) {
      await this.deductFromSourceBufferCards({ orderId, nomenclatureId, totalQtyToDeduct })
    }

    return data || []
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
