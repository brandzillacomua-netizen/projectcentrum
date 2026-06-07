import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const test = async () => {
    const login = 'admin'
    // Let's try some common default passwords for admin
    const candidates = ['admin', '123456', 'admin123', 'password123', 'kulytsya', 'centrum']
    
    console.log(`Testing verify_user_password for user "${login}":`)
    for (const pw of candidates) {
      const { data, error } = await supabase.rpc('verify_user_password', {
        login_name: login,
        plain_password: pw
      })
      if (error) {
        console.error(`Error with password "${pw}":`, error)
      } else {
        console.log(`Password "${pw}" verification:`, data && data.length > 0 ? "SUCCESS" : "FAILED")
        if (data && data.length > 0) {
          console.log("Returned User Profile:", data[0])
          break
        }
      }
    }
  }
  
  test()
} else {
  console.error('Could not find Supabase credentials')
}
