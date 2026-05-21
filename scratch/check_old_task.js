import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Fetching task b86a53c9-a18e-46d1-88be-02c042ad678e...")
    const { data: task } = await supabase.from('tasks').select('*').eq('id', 'b86a53c9-a18e-46d1-88be-02c042ad678e').single()
    console.log("Task plan_snapshot:")
    console.log(JSON.stringify(task.plan_snapshot, null, 2))
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
