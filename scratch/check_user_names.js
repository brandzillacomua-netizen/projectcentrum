import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1], {
    global: {
      headers: {
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }
  })
  
  const check = async () => {
    const { data: user, error } = await supabase.from('system_users').select('*').eq('login', 'm4.ws1').single()
    if (error) {
      console.error(error)
      return
    }
    console.log("User details:")
    console.log("last_name:", JSON.stringify(user.last_name))
    console.log("first_name:", JSON.stringify(user.first_name))
    console.log("login:", JSON.stringify(user.login))
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
