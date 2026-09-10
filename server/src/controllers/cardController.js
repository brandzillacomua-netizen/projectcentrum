import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function handleCreateWorkCardsBatch(payload, res) {
  try {
    const { taskId, orderId, nomenclatureId, cardsArray } = payload

    if (!taskId || !cardsArray || !Array.isArray(cardsArray)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'taskId and cardsArray are required' }))
    }

    const cardRows = cardsArray.map((c, idx) => ({
      task_id: taskId,
      order_id: orderId || null,
      nomenclature_id: nomenclatureId || c.nomenclature_id,
      operation: c.operation || 'розкрій',
      machine: c.machine || 'Різні верстати',
      estimated_time: Math.round(Number(c.estimatedTime || c.estimated_time) || 0),
      card_info: c.cardInfo || c.card_info || `ПАРТІЯ №${idx + 1}`,
      quantity: Number(c.quantity) || 1,
      status: c.status || 'at-buffer',
      is_rework: Boolean(c.is_rework),
      created_at: new Date().toISOString()
    }))

    const { data: createdCards, error } = await supabaseAdmin
      .from('work_cards')
      .insert(cardRows)
      .select('id, card_info, quantity, status')

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Work cards batch created transactionally via Core Engine',
      cardsCount: createdCards?.length || 0,
      cards: createdCards
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}
