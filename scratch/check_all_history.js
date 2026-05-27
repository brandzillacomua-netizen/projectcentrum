import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const nomId = '7e8d056d-06b2-42a7-88e1-12186b914948'
    console.log('Querying ALL work_card_history for F610-ІП24-Н-3-14:')
    const { data: histData, error: histError } = await supabase
      .from('work_card_history')
      .select('*')
      .eq('nomenclature_id', nomId)
      .order('created_at', { ascending: true })
    
    if (histError) console.error(histError)
    else {
      console.log(`Total history records: ${histData.length}`)
      histData.forEach(h => {
        console.log(`- ID: ${h.id}, Card: ${h.card_id}, Stage: ${h.stage_name}, StartQty: ${h.qty_at_start}, CompQty: ${h.qty_completed}, Scrap: ${h.scrap_qty}, Created: ${h.created_at}`)
      })
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
