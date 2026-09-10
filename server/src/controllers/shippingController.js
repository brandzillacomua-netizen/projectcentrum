import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function handleShipOrder(payload, res) {
  try {
    const { orderId } = payload
    if (!orderId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'orderId is required' }))
    }

    const { error } = await supabaseAdmin
      .from('orders')
      .update({
        status: 'shipped',
        actual_date: new Date().toISOString()
      })
      .eq('id', orderId)

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Order shipped via Core Engine',
      orderId,
      status: 'shipped'
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}
