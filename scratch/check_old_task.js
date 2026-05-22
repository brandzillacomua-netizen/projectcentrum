import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Fetching task c54c9af2-bcc6-4fc7-8e61-9b287e30f53a...")
    const { data: task } = await supabase.from('tasks').select('*').eq('id', 'c54c9af2-bcc6-4fc7-8e61-9b287e30f53a').single()
    console.log("Task plan_snapshot:")
    console.log(JSON.stringify(task.plan_snapshot, null, 2))
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
