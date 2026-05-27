import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying all inventory items for F610-ІП24-В-3-15:')
    const { data: invs } = await supabase
      .from('inventory')
      .select('*')
      .ilike('name', '%F610-ІП24-В-3-15%')
    console.log(invs)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
