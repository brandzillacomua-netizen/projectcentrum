import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Fetching latest work cards...")
    const { data: cards } = await supabase.from('work_cards').select('id, machine, quantity, card_info, created_at, status, operation').order('created_at', { ascending: false }).limit(10)
    console.table(cards)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
