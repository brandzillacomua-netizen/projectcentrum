import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1], {
    global: {
      headers: {
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }
  })
  
  const check = async () => {
    // 1. Find the order №22062026-03
    const { data: orders } = await supabase.from('orders')
      .select('id, order_num')
      .eq('order_num', '22062026-03')
    
    if (!orders || orders.length === 0) {
      console.log("Order not found")
      return
    }
    const orderId = orders[0].id
    console.log("Found Order ID:", orderId)

    // 2. Find tasks for this order
    const { data: tasks } = await supabase.from('tasks')
      .select('id, step, status')
      .eq('order_id', orderId)
    console.log("Found Tasks:")
    console.log(tasks)

    for (const t of tasks) {
      // 3. Find work cards for this task
      const { data: cards } = await supabase.from('work_cards')
        .select('id, nomenclature_id, status, quantity, card_info, is_rework, operation, created_at')
        .eq('task_id', t.id)
      console.log(`Cards for Task ${t.id} (${t.step}): ${cards?.length}`)
      cards?.forEach(c => {
        console.log(`  Card ID: ${c.id} | Info: ${c.card_info} | Op: ${c.operation} | Status: ${c.status} | is_rework: ${c.is_rework} | Qty: ${c.quantity}`)
      })
    }
  }
  
  check()
} else {
  console.error('Credentials error')
}
