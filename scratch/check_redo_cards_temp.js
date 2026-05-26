import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('A:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking redo cards...")
    const { data: cards, error } = await supabase
      .from('work_cards')
      .select('id, card_info, status, is_rework, created_at, task_id')
      .eq('is_rework', true)
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error("Error:", error)
      return
    }
    
    console.log(`Found ${cards.length} redo cards:`)
    for (const card of cards) {
      console.log(`ID: ${card.id} | Info: ${card.card_info} | Status: ${card.status} | TaskID: ${card.task_id} | Created: ${card.created_at}`)
      // Fetch material requests for this card's task
      const { data: reqs } = await supabase
        .from('material_requests')
        .select('id, status, details, quantity')
        .eq('task_id', card.task_id)
      console.log(`  Task Material Requests:`, reqs)
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
