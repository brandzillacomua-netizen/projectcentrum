import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying ALL work_card_history entries on 2026-05-27:')
    const { data: histData } = await supabase
      .from('work_card_history')
      .select('*, nomenclatures(name)')
      .gte('created_at', '2026-05-27T00:00:00.000Z')
      .order('created_at', { ascending: true })
      
    histData?.forEach(h => {
      console.log(`- Time: ${h.created_at}, Name: ${h.nomenclatures?.name}, Stage: ${h.stage_name}, Qty: ${h.qty_at_start}->${h.qty_completed}, Scrap: ${h.scrap_qty}`)
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
