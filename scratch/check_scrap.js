import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const nomId = '7e8d056d-06b2-42a7-88e1-12186b914948' // F610-ІП24-Н-3-14
    console.log('Querying inventory for F610-ІП24-Н-3-14:')
    const { data: invData, error: invError } = await supabase
      .from('inventory')
      .select('*')
      .eq('nomenclature_id', nomId)
    
    if (invError) console.error('Inventory error:', invError)
    else console.log('Inventory data:', invData)

    console.log('Querying work_card_history for F610-ІП24-Н-3-14 scrap occurrences:')
    const { data: histData, error: histError } = await supabase
      .from('work_card_history')
      .select('*')
      .eq('nomenclature_id', nomId)
      .gt('scrap_qty', 0)
    
    if (histError) console.error('History error:', histError)
    else console.log('History scrap data:', histData)

    console.log('Querying work_cards for F610-ІП24-Н-3-14:')
    const { data: cardsData, error: cardsError } = await supabase
      .from('work_cards')
      .select('*')
      .eq('nomenclature_id', nomId)
    
    if (cardsError) console.error('Cards error:', cardsError)
    else console.log('Cards data:', cardsData)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
