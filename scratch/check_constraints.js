import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying indexes/constraints for work_card_history:')
    // Let's see if we can get some info
    const { data, error } = await supabase
      .from('work_card_history')
      .select('*')
      .limit(2)
    console.log('Sample data:', data)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
