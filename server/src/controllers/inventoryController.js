import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function handleDeductInventory(payload, res) {
  try {
    const { inventoryId, deductTotal, releaseReserved } = payload

    if (!inventoryId) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'inventoryId is required' }))
    }

    const { data, error } = await supabaseAdmin.rpc('rpc_deduct_inventory_atomic', {
      p_inventory_id: inventoryId,
      p_deduct_total: Number(deductTotal) || 0,
      p_release_reserved: Number(releaseReserved) || 0
    })

    if (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: error.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Inventory deducted transactionally via Core Engine',
      result: data
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}
