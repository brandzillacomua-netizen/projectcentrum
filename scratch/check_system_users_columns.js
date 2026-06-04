import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Checking system_users table structure...')
    const { data, error } = await supabase.from('system_users').select('*').limit(1)
    if (error) {
      console.error('Error fetching system_users:', error)
    } else if (data && data.length > 0) {
      console.log('Available columns in system_users table:', Object.keys(data[0]))
    } else {
      console.log('system_users table is empty or could not be read.')
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
