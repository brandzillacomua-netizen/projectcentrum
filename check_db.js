import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// Load env vars if possible, otherwise we might need to find them in the code
// Let's try to read them from the project files first
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[2])
  
  const check = async () => {
    console.log('Checking tasks table structure...')
    const { data, error } = await supabase.from('tasks').select('*').limit(1)
    if (error) {
      console.error('Error fetching tasks:', error)
    } else if (data && data.length > 0) {
      console.log('Available columns in tasks table:', Object.keys(data[0]))
    } else {
      console.log('Tasks table is empty or could not be read.')
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
