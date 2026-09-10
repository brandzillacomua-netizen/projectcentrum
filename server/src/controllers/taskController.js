import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function handleCreateTask(payload, res) {
  try {
    const orderId = payload.orderId || payload.order_id
    if (!orderId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'orderId is required' }))
    }

    const planSnapshot = payload.planSnapshot || payload.plan_snapshot || {}
    const { data: taskObj, error } = await supabaseAdmin
      .from('tasks')
      .insert([{
        order_id: orderId,
        step: payload.step || 1,
        plan_snapshot: planSnapshot,
        warehouse_conf: 'false',
        engineer_conf: false,
        director_conf: false,
        created_at: new Date().toISOString()
      }])
      .select('id, step, order_id')
      .single()

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Task created via Core Engine',
      task: taskObj
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}

export async function handleApproveTask(payload, res, role) {
  try {
    const { taskId, warehouseStatus } = payload
    if (!taskId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'taskId is required' }))
    }

    const updatePayload = {}
    if (role === 'engineer') updatePayload.engineer_conf = true
    if (role === 'director') updatePayload.director_conf = true
    if (role === 'warehouse') updatePayload.warehouse_conf = warehouseStatus || 'true'

    const { error } = await supabaseAdmin
      .from('tasks')
      .update(updatePayload)
      .eq('id', taskId)

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: `Task approved by ${role} via Core Engine`,
      taskId,
      role
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}
