import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1], {
    global: {
      headers: {
        'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
      }
    }
  })
  
  const check = async () => {
    const { data: users, error } = await supabase.from('system_users').select('*')
    if (error) {
      console.error(error)
      return
    }
    console.log("System Users:")
    users.forEach(u => {
      console.log(`- ${u.id}: ${u.login} | Name: ${u.last_name} ${u.first_name} | Pos: ${u.position} | Dept: ${u.department} | Shift: ${u.shift}`)
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
