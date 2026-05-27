import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const nomId = 'a3498c79-c914-4526-8abf-a56fd0735794'
    console.log('Querying work_card_history for F610-ІП24-В-3-15:')
    const { data: hist } = await supabase
      .from('work_card_history')
      .select('*')
      .eq('nomenclature_id', nomId)
    console.log(hist)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
