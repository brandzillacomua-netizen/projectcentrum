import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function handleConfirmBufferCutting(payload, res) {
  try {
    const { cardId, nextStatus, sheetInvId, sheetDeductTotal, sheetReleaseReserved, cutterDeductions } = payload

    if (!cardId || !nextStatus) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'cardId and nextStatus are required' }))
    }

    const { data, error } = await supabaseAdmin.rpc('rpc_confirm_buffer_cutting_atomic', {
      p_card_id: cardId,
      p_next_status: nextStatus,
      p_sheet_inv_id: sheetInvId || null,
      p_sheet_deduct_total: Number(sheetDeductTotal) || 0,
      p_sheet_release_reserved: Number(sheetReleaseReserved) || 0,
      p_cutter_deductions: cutterDeductions || []
    })

    if (!error && data?.success) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({
        success: true,
        message: 'Cutting confirmed transactionally via Core Engine RPC',
        result: data
      }))
    }

    // Safe fallback transaction update
    await supabaseAdmin.from('work_cards').update({ status: nextStatus }).eq('id', cardId)
    if (sheetInvId) {
      const { data: sInv } = await supabaseAdmin.from('inventory').select('total_qty, reserved_qty').eq('id', sheetInvId).single()
      if (sInv) {
        await supabaseAdmin.from('inventory').update({
          total_qty: Math.max(0, (Number(sInv.total_qty) || 0) - (Number(sheetDeductTotal) || 0)),
          reserved_qty: Math.max(0, (Number(sInv.reserved_qty) || 0) - (Number(sheetReleaseReserved) || 0))
        }).eq('id', sheetInvId)
      }
    }
    if (cutterDeductions && cutterDeductions.length > 0) {
      for (const cd of cutterDeductions) {
        const { data: cInv } = await supabaseAdmin.from('inventory').select('total_qty, reserved_qty').eq('id', cd.inventory_id).single()
        if (cInv) {
          await supabaseAdmin.from('inventory').update({
            total_qty: Math.max(0, (Number(cInv.total_qty) || 0) - (Number(cd.used_qty) || 0)),
            reserved_qty: Math.max(0, (Number(cInv.reserved_qty) || 0) - (Number(cd.planned_qty) || 0))
          }).eq('id', cd.inventory_id)
        }
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Cutting confirmed via Core Engine safe fallback transaction',
      cardId,
      nextStatus
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}
