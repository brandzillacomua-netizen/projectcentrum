import { useState } from 'react'
import { supabase as supabaseClient } from '../../../supabase'
import { apiService } from '../../../services/apiDispatcher'
import { useMES } from '../../../MESContext'

export function useWarehouseActions(dataHook) {
  const { nomenclatures, inventory, requests, purchaseRequests, receptionDocs, confirmReception, issueMaterialsBatch, createPurchaseRequest, refreshTable } = useMES()

  const normalize = (s) => (s || '').toLowerCase().trim()
    .replace(/[тt]/g, 't').replace(/[аa]/g, 'a').replace(/[еe]/g, 'e')
    .replace(/[оo]/g, 'o').replace(/[рp]/g, 'p').replace(/[сc]/g, 'c')
    .replace(/[хx]/g, 'x')
    .replace(/[іi]/g, 'i')
    .replace(/[уy]/g, 'y')
    .replace(/[кk]/g, 'k')
    .replace(/[мm]/g, 'm')
    .replace(/[нn]/g, 'n')
    .replace(/[вv]/g, 'v')
    .replace(/[и]/g, 'y')
    .replace(/[зz]/g, 'z')
    .replace(/\s/g, '')

  const parseMaterialName = (details) => {
    if (!details) return ''
    if (details.includes('ВИТРАТНІ МАТЕРІАЛИ')) {
      const match = details.match(/:\s*(.+)\s*—/)
      return match ? match[1].trim() : details
    }
    return details.split(': ')[1]?.split(' — ')[0]?.trim() || details
  }

  const handleToggleCutterCheck = (cardId, nomId) => {
    dataHook.setCheckedCutters(prev => {
      const cardState = prev[cardId] || {}
      return {
        ...prev,
        [cardId]: {
          ...cardState,
          [nomId]: !cardState[nomId]
        }
      }
    })
  }

  const handlePrepareBox = async (boxItem) => {
    dataHook.setIsProcessing(true)
    try {
      const { card, cutters } = boxItem
      for (const cutter of cutters) {
        const { data: matchedInventory, error: invErr } = await supabaseClient
          .from('inventory')
          .select('*')
          .eq('nomenclature_id', cutter.nomenclature_id)
        
        if (invErr) throw invErr

        const invItem = (matchedInventory || []).find(i => i.warehouse === 'operational' || !i.warehouse) 
          || (matchedInventory || [])[0]

        const qtyToDeduct = cutter.qty

        if (invItem) {
          const nextTotal = Math.max(0, (Number(invItem.total_qty) || 0) - qtyToDeduct)
          await supabaseClient.from('inventory')
            .update({ 
              total_qty: nextTotal, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', invItem.id)
        }

        const { data: existingReq } = await supabaseClient
          .from('material_requests')
          .select('*')
          .eq('card_id', card.id)
          .eq('nomenclature_id', cutter.nomenclature_id)
          .maybeSingle()

        if (existingReq) {
          await supabaseClient.from('material_requests')
            .update({ quantity: qtyToDeduct, status: 'completed' })
            .eq('id', existingReq.id)
        } else {
          const cardLabel = card.card_info?.split(' ')[0] || `№${card.id.substring(0, 8)}`
          await supabaseClient.from('material_requests').insert({
            order_id: card.order_id,
            task_id: card.task_id,
            card_id: card.id,
            nomenclature_id: cutter.nomenclature_id,
            quantity: qtyToDeduct,
            status: 'completed',
            details: `СКЛАД ОПЕРАТИВНИЙ (Картка ${cardLabel}) (ОБРАНО ВРУЧНУ): ${cutter.name} — ${qtyToDeduct} шт.`
          })
        }
      }

      const nextCardInfo = `${card.card_info || ''} [BOX_PREPARED:true]`.trim()
      const { error: cardUpdateErr } = await supabaseClient
        .from('work_cards')
        .update({ card_info: nextCardInfo })
        .eq('id', card.id)

      if (cardUpdateErr) throw cardUpdateErr

      alert('Бокс фрез успішно укомплектовано та списано!')
      refreshTable('work_cards')
      refreshTable('inventory')
      refreshTable('material_requests')
    } catch (err) {
      alert('Помилка підготовки боксу: ' + err.message)
    } finally {
      dataHook.setIsProcessing(false)
    }
  }

  const handleIssueCardMaterials = async () => {
    dataHook.setIsIssuingCard(true)
    try {
      const pendingReqs = dataHook.scannedRequests.filter(r => r.status === 'pending' || r.status === 'issued')
      
      for (const req of pendingReqs) {
        const { data: matchedInventory, error: invErr } = await supabaseClient
          .from('inventory')
          .select('*')
          .or(`id.eq.${req.inventory_id || 0},nomenclature_id.eq.${req.nomenclature_id || 0}`)
        
        if (invErr) throw invErr

        const invItem = (matchedInventory || []).find(i => i.warehouse === 'operational' || !i.warehouse) 
          || (matchedInventory || [])[0]

        const qtyToDeduct = req.displayQty ?? Number(req.quantity) ?? 0

        if (invItem) {
          const nextTotal = Math.max(0, (Number(invItem.total_qty) || 0) - qtyToDeduct)
          const wasReserved = req.status === 'issued'
          const nextReserved = wasReserved 
            ? Math.max(0, (Number(invItem.reserved_qty) || 0) - qtyToDeduct)
            : (Number(invItem.reserved_qty) || 0)

          await supabaseClient.from('inventory')
            .update({ 
              total_qty: nextTotal, 
              reserved_qty: nextReserved, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', invItem.id)
        }

        if (req.isSheet) {
          const nextQty = Math.max(0, (Number(req.quantity) || 0) - qtyToDeduct)
          const nextStatus = nextQty === 0 ? 'completed' : req.status
          await supabaseClient.from('material_requests')
            .update({ quantity: nextQty, status: nextStatus })
            .eq('id', req.id)
        } else {
          if (req.isSynthetic) {
            await supabaseClient.from('material_requests').insert({
              order_id: req.order_id,
              task_id: req.task_id,
              card_id: req.card_id,
              nomenclature_id: req.nomenclature_id,
              quantity: qtyToDeduct,
              status: 'completed',
              details: req.details
            })
          } else {
            await supabaseClient.from('material_requests')
              .update({ quantity: qtyToDeduct, status: 'completed' })
              .eq('id', req.id)
          }
        }
      }

      alert('Матеріали успішно списано та видано!')
      dataHook.setScannedCard(null)
      dataHook.setScannedRequests([])
      dataHook.setIsScanning(false)
      refreshTable('inventory')
      refreshTable('material_requests')
    } catch (err) {
      alert('Помилка видачі: ' + err.message)
    } finally {
      dataHook.setIsIssuingCard(false)
    }
  }

  return {
    handleToggleCutterCheck,
    handlePrepareBox,
    handleIssueCardMaterials,
    parseMaterialName,
    normalize
  }
}
