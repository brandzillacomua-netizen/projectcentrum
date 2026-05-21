import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data, error } = await supabase.from('company_structure').select('*').limit(1)
    if (error) {
      console.log("Error querying company_structure:", error.message)
    } else {
      console.log("company_structure sample data:", data)
    }
  }
  
  check()
} else {
  console.error('Could not find credentials')
}
