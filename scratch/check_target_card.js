import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Fetching card...")
    const { data: card } = await supabase.from('work_cards').select('*').eq('id', '5c9fcf45-7cfd-424b-8b84-da59cdb74581').single()
    console.log("Card details:", JSON.stringify(card, null, 2))
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
