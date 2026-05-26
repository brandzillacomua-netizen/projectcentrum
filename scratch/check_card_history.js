import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('A:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking history for card 65ff0814-4d39-43e9-8a95-c755bd695af4...")
    const { data: card, error: cardErr } = await supabase
      .from('work_cards')
      .select('*')
      .eq('id', '65ff0814-4d39-43e9-8a95-c755bd695af4')
      .single()
    
    if (cardErr) {
      console.error("Card Error:", cardErr)
      return
    }
    
    console.log("Card:", card)
    
    const { data: history, error: histErr } = await supabase
      .from('work_card_history')
      .select('*')
      .eq('card_id', '65ff0814-4d39-43e9-8a95-c755bd695af4')
    
    if (histErr) {
      console.error("History Error:", histErr)
      return
    }
    
    console.log("History:", history)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
