import { supabaseAdmin } from '../config/supabaseAdmin.js'

/**
 * Restores a defective part back into the production task flow (Shop 2 buffer)
 */
export async function handleVkyaDefectRestore(payload, res) {
  try {
    const { taskId, orderId, nomenclatureId, cardInfo, quantity } = payload
    if (!taskId || !nomenclatureId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'taskId and nomenclatureId are required' }))
    }

    const { data: card, error } = await supabaseAdmin
      .from('work_cards')
      .insert([{
        task_id: taskId,
        order_id: orderId || null,
        nomenclature_id: nomenclatureId,
        operation: 'гнуття / цех 2',
        machine: 'Цех 2',
        card_info: cardInfo || 'ВКТ ВІДНОВЛЕНО',
        quantity: Number(quantity) || 1,
        status: 'at-shop2-buffer',
        is_rework: false,
        created_at: new Date().toISOString()
      }])
      .select('id, card_info, status, quantity')
      .single()

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Part restored by VKYA to Shop 2 buffer via Core Engine',
      card
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}

/**
 * Triggers Dovypusk (re-issue) for unrecoverable scrap with is_rework = true
 */
export async function handleVkyaDovypusk(payload, res) {
  try {
    const { taskId, orderId, nomenclatureId, cardInfo, quantity } = payload
    if (!taskId || !nomenclatureId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'taskId and nomenclatureId are required' }))
    }

    const { data: card, error } = await supabaseAdmin
      .from('work_cards')
      .insert([{
        task_id: taskId,
        order_id: orderId || null,
        nomenclature_id: nomenclatureId,
        operation: 'розкрій (довипуск)',
        machine: 'ЧПУ №1',
        card_info: cardInfo || 'ДОВИПУСК БРАКУ',
        quantity: Number(quantity) || 1,
        status: 'at-shop2-buffer',
        is_rework: true,
        created_at: new Date().toISOString()
      }])
      .select('id, card_info, status, quantity, is_rework')
      .single()

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Dovypusk generated with is_rework = true via Core Engine',
      card
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}

/**
 * Transfers card batch to Shop 2 Buffer
 */
export async function handleTransferToShop2(payload, res) {
  try {
    const { cardIds } = payload
    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'cardIds array is required' }))
    }

    const { error } = await supabaseAdmin
      .from('work_cards')
      .update({ status: 'at-shop2-buffer' })
      .in('id', cardIds)

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Cards transferred to Shop 2 buffer via Core Engine',
      cardIds
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}

/**
 * Queries Shop 2 buffer items for a task
 */
export async function handleGetShop2Buffer(taskId, res) {
  try {
    if (!taskId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'taskId parameter is required' }))
    }

    const { data: cards, error } = await supabaseAdmin
      .from('work_cards')
      .select('id, nomenclature_id, quantity, status, is_rework, card_info')
      .eq('task_id', taskId)
      .eq('status', 'at-shop2-buffer')

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    const totalQuantity = (cards || []).reduce((acc, c) => acc + (Number(c.quantity) || 0), 0)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      taskId,
      cardsCount: cards?.length || 0,
      totalQuantity,
      cards
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}
