import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    // 1. Get task for 22062026-03
    const { data: orders } = await supabase.from('orders').select('*')
    console.log("All Orders (first 10):", orders.slice(0, 10).map(o => o.order_num))
    
    const targetOrder = orders.find(o => o.order_num && o.order_num.includes('22062026-03'))
    console.log("Target Order:", targetOrder)
    
    if (targetOrder) {
      const { data: orderTasks } = await supabase.from('tasks').select('*').eq('order_id', targetOrder.id)
      console.log("Order Tasks found:", orderTasks)
      
      if (orderTasks && orderTasks.length > 0) {
        const tId = orderTasks[0].id
        const { data: cards } = await supabase.from('work_cards').select('id, card_info, status, quantity, is_rework, nomenclature_id').eq('task_id', tId)
        console.log(`Cards found for task ${tId} (count: ${cards.length}):`)
        cards.forEach(c => {
          if ((c.card_info || '').includes('[REDO]') || c.is_rework || (c.card_info || '').includes('REDO')) {
            console.log("REDO CARD:", c)
          }
        })
      }
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
