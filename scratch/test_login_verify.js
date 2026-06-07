import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const check = async () => {
    // 1. Without header
    console.log("--- Check WITHOUT header ---")
    const clientNoHeader = createClient(urlMatch[1], keyMatch[1])
    const { data: users1, error: err1 } = await clientNoHeader.from('system_users').select('id, login, password').limit(3)
    if (err1) console.error("Error without header:", err1)
    else console.log("Users count:", users1.length, "Data:", users1)

    // 2. With header
    console.log("\n--- Check WITH header ---")
    const clientWithHeader = createClient(urlMatch[1], keyMatch[1], {
      global: {
        headers: {
          'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
        }
      }
    })
    const { data: users2, error: err2 } = await clientWithHeader.from('system_users').select('id, login, password').limit(3)
    if (err2) console.error("Error with header:", err2)
    else console.log("Users count:", users2.length, "Data:", users2)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
