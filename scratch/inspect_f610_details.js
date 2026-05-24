import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const nomId = 'a3498c79-c914-4526-8abf-a56fd0735794' // F610-ІП24-В-3-15
    const { data: cards } = await supabase.from('work_cards').select('*').eq('nomenclature_id', nomId)
    const { data: inv } = await supabase.from('inventory').select('*').eq('nomenclature_id', nomId)
    
    console.log("Cards:")
    cards.forEach(c => {
      console.log(`- Card ID: ${c.id}, Status: ${c.status}, Op: ${c.operation}, Qty: ${c.quantity}, UsedInShop2: ${c.used_in_shop2_qty}`)
    })
    
    console.log("Inventory:")
    inv.forEach(i => {
      console.log(`- Inv ID: ${i.id}, Type: ${i.type}, Qty: ${i.total_qty}`)
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
