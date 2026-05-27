import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying all inventory rows with type containing scrap:')
    const { data: invs } = await supabase
      .from('inventory')
      .select('*')
      .like('type', '%scrap%')
      
    invs?.forEach(i => {
      console.log(`- ID: ${i.id}, Name: ${i.name}, Type: ${i.type}, Qty: ${i.total_qty}, Updated: ${i.updated_at}`)
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
