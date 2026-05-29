import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data, error } = await supabase
      .from('nomenclatures')
      .select('*')
      .or('name.ilike.%210%,name.ilike.%218%')
    
    if (error) {
      console.error(error)
      return
    }
    
    console.log(`Found ${data.length} nomenclatures containing 210 or 218:`)
    data.forEach(n => {
      console.log(`- ID: ${n.id}, Type: ${n.type}, Name: "${n.name}"`)
    })
  }
  
  check()
}
