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
      console.log("Specific key '90c17a0c-2c69-485e-a2cf-ed10909c816d':")
      console.log(tasks[0].plan_snapshot['90c17a0c-2c69-485e-a2cf-ed10909c816d'])
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
