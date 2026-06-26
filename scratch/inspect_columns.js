import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .limit(1)
    
    if (tasks && tasks[0]) {
      console.log("Task columns:", Object.keys(tasks[0]))
      console.log("Sample task:", tasks[0])
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
