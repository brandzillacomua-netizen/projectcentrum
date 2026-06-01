import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, order_num')
      .ilike('order_num', '%29052026-07%')

    const orderId = orders[0].id
    const nomId = "dcef3b2e-de4d-4540-90a5-63ebcbab1545" // ІП-72-F5-Н-3-50

    const { data: cards } = await supabase
      .from('work_cards')
      .select('id, task_id, quantity, status, operation, used_in_shop2_qty, card_info')
      .eq('order_id', orderId)
      .eq('nomenclature_id', nomId)
    
    console.log(`Found ${cards.length} cards in work_cards:`)
    cards.forEach(c => {
      console.log(`- Card ID: ${c.id}, Task ID: ${c.task_id}, Qty: ${c.quantity}, Status: ${c.status}, Op: ${c.operation}, Used Qty: ${c.used_in_shop2_qty}`)
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
