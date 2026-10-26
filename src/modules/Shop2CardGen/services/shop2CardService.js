import { supabase } from '../../../supabase'
import { isPackagingOperation } from '../constants/shop2Stages'

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
  async createShop2CardsBatch({ taskId, orderId, nomenclatureId, cardsBatch, userId = null, sourceOrderIds = [], sourceNomenclatureIds = [] }) {
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

      const op = item.operation || 'Пресування'
      const isPack = isPackagingOperation(op) || isPackagingOperation(cardInfo) || op.toLowerCase().includes('пакува') || op.toLowerCase().includes('сгп')

      return {
        task_id: taskId,
        order_id: orderId,
        nomenclature_id: nomenclatureId,
        operation: isPack ? 'Склад СГП' : op,
        machine: item.machine || 'Не вказано',
        quantity: item.quantity,
        card_info: cardInfo,
        status: isPack ? 'completed' : (item.status || 'new'),
        completed_at: isPack ? (item.completed_at || new Date().toISOString()) : (item.completed_at || null),
        is_rework: Boolean(item.is_rework)
      }
    })

    const totalQtyToDeduct = cardsBatch.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
    const directPackQty = insertPayloads
      .filter(p => p.operation === 'Склад СГП' || p.status === 'completed')
      .reduce((sum, p) => sum + (Number(p.quantity) || 0), 0)

    // ── ATOMIC ENTERPRISE RPC EXECUTION ──────────────────────────────────────────
    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('rpc_generate_shop2_cards_atomic', {
        p_order_id: orderId || null,
        p_nomenclature_id: nomenclatureId,
        p_cards_payload: insertPayloads,
        p_total_qty_to_deduct: totalQtyToDeduct,
        p_user_id: userId || 'Майстер Цеху №2',
        // Scope parity with UI: rerun (-Д) child orders + legacy nomenclature IDs
        p_source_order_ids: sourceOrderIds.length > 0 ? sourceOrderIds : null,
        p_source_nomenclature_ids: sourceNomenclatureIds.length > 0 ? sourceNomenclatureIds : null
      })

      if (!rpcErr && rpcRes?.success) {
        if (directPackQty > 0) {
          await this.transferDirectSgpInventory({ nomenclatureId, directPackQty, sourceNomenclatureIds })
        }
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
      await this.deductFromSourceBufferCards({ orderId, nomenclatureId, totalQtyToDeduct, legacyIds: sourceNomenclatureIds, sourceOrderIds })
    }

    if (directPackQty > 0) {
      await this.transferDirectSgpInventory({ nomenclatureId, directPackQty, sourceNomenclatureIds })
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
   * Transfer inventory from semi_shop2/bz_shop2 to finished on SGP for direct handovers
   */
  async transferDirectSgpInventory({ nomenclatureId, directPackQty, sourceNomenclatureIds = [] }) {
    if (!directPackQty || directPackQty <= 0) return
    try {
      const allNomIds = Array.from(new Set([nomenclatureId, ...sourceNomenclatureIds].filter(Boolean)))
      // 1. Deduct from semi_shop2 / bz_shop2
      const { data: semiRows } = await supabase
        .from('inventory')
        .select('*')
        .in('nomenclature_id', allNomIds)
        .in('type', ['semi_shop2', 'bz_shop2'])

      let remaining = directPackQty
      const sortedSemi = (semiRows || []).sort((a, b) => (a.type === 'semi_shop2' ? -1 : 1))
      for (const r of sortedSemi) {
        if (remaining <= 0) break
        const current = Number(r.total_qty) || 0
        const take = Math.min(current, remaining)
        if (take > 0) {
          await supabase.from('inventory').update({
            total_qty: current - take,
            updated_at: new Date().toISOString()
          }).eq('id', r.id)
          remaining -= take
        }
      }

      // 2. Add to finished on sgp
      const { data: finishedItem } = await supabase
        .from('inventory')
        .select('*')
        .in('nomenclature_id', allNomIds)
        .eq('type', 'finished')
        .eq('warehouse', 'sgp')
        .limit(1)
        .maybeSingle()

      if (finishedItem) {
        await supabase.from('inventory').update({
          total_qty: (Number(finishedItem.total_qty) || 0) + directPackQty,
          updated_at: new Date().toISOString()
        }).eq('id', finishedItem.id)
      } else {
        const { data: nom } = await supabase
          .from('nomenclatures_v2')
          .select('name, unit')
          .eq('id', nomenclatureId)
          .maybeSingle()

        await supabase.from('inventory').insert([{
          nomenclature_id: nomenclatureId,
          name: nom?.name || 'Деталь',
          unit: nom?.unit || 'шт',
          total_qty: directPackQty,
          reserved_qty: 0,
          type: 'finished',
          warehouse: 'sgp',
          updated_at: new Date().toISOString()
        }])
      }
    } catch (e) {
      console.warn('[shop2CardService] transferDirectSgpInventory warning:', e?.message || e)
    }
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
  async deductFromSourceBufferCards({ orderId, nomenclatureId, totalQtyToDeduct, legacyIds = [], sourceOrderIds = [] }) {
    try {
      let searchIds = Array.from(new Set([nomenclatureId, ...(legacyIds || [])].filter(Boolean)))
      if (searchIds.length === 1 && nomenclatureId) {
        const { data: nomRow } = await supabase
          .from('nomenclatures')
          .select('id, legacy_ids')
          .eq('id', nomenclatureId)
          .maybeSingle()
        if (nomRow && Array.isArray(nomRow.legacy_ids) && nomRow.legacy_ids.length > 0) {
          searchIds = Array.from(new Set([nomenclatureId, ...nomRow.legacy_ids.map(String)]))
        }
      }

      const { data: sourceCards, error } = await supabase
        .from('work_cards')
        .select('id, quantity, used_in_shop2_qty, status, is_rework, order_id')
        .in('nomenclature_id', searchIds)

      if (error || !sourceCards) return

      // Filter buffer cards: matching order or shared buffer (null order_id)
      const allowedOrders = new Set([orderId, ...(sourceOrderIds || [])].filter(Boolean).map(String))
      const bufferCards = sourceCards
        .filter(c => (c.status === 'at-shop2-buffer' || c.is_rework) && (allowedOrders.size === 0 || !c.order_id || allowedOrders.has(String(c.order_id))))
        .sort((a, b) => {
          if (orderId) {
            if (a.order_id === orderId && b.order_id !== orderId) return -1
            if (b.order_id === orderId && a.order_id !== orderId) return 1
          }
          return 0
        })

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
