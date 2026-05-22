import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data: users, error } = await supabase.from('system_users').select('*')
    if (error) {
      console.error(error)
      return
    }
    console.log("Users:")
    users.forEach(u => {
      console.log(`- ${u.first_name} ${u.last_name} (${u.login}): dept=${u.department}, shift=${u.shift}, pos=${u.position}`)
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
