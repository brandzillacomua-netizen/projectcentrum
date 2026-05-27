import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying all inventory items with name Деталь:')
    const { data: invs } = await supabase
      .from('inventory')
      .select('*')
      .eq('name', 'Деталь')
    console.log(invs)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
