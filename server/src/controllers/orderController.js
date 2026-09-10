import { supabaseAdmin } from '../config/supabaseAdmin.js'

export async function handleCreateOrder(payload, res) {
  try {
    const { header, items } = payload
    if (!header || !items || !Array.isArray(items)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: 'header and items array are required' }))
    }

    // 1. Resolve or auto-create Customer
    let customerId = header.customer_id || null
    if (header.customer && !customerId) {
      const trimmedName = header.customer.trim()
      const { data: existing } = await supabaseAdmin
        .from('customers')
        .select('id')
        .ilike('name', trimmedName)
        .maybeSingle()

      if (existing) {
        customerId = existing.id
      } else {
        const { data: created } = await supabaseAdmin
          .from('customers')
          .insert([{ name: trimmedName, official_name: header.official_customer?.trim() || '' }])
          .select('id')
          .single()

        if (created) customerId = created.id
      }
    }

    // 2. Insert Order Header
    const orderNum = header.order_num || `ORD-${Date.now()}`
    const { data: orderObj, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert([{
        order_num: orderNum,
        customer_id: customerId,
        customer: header.customer || '',
        invoice_num: header.invoice_num || null,
        status: 'draft',
        created_at: new Date().toISOString()
      }])
      .select('id, order_num')
      .single()

    if (orderErr) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: orderErr.message }))
    }

    // 3. Insert Order Items
    const itemRows = items.map(item => ({
      order_id: orderObj.id,
      nomenclature_id: item.nomenclature_id || item.nomId,
      quantity: Number(item.quantity) || 1,
      created_at: new Date().toISOString()
    }))

    const { error: itemsErr } = await supabaseAdmin
      .from('order_items')
      .insert(itemRows)

    if (itemsErr) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      return res.end(JSON.stringify({ success: false, error: itemsErr.message }))
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({
      success: true,
      message: 'Order created via Core Engine',
      order: orderObj
    }))
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ success: false, error: err.message }))
  }
}
