import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying inventory columns:')
    const { data, error } = await supabase.from('inventory').select('*').limit(1)
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]))
    } else {
      console.log('No rows or error:', error)
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
