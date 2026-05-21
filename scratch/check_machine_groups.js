import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Grouping work cards by machine:")
    const { data: cards } = await supabase.from('work_cards').select('machine')
    const counts = {}
    cards?.forEach(c => {
      counts[c.machine] = (counts[c.machine] || 0) + 1
    })
    console.log(counts)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
