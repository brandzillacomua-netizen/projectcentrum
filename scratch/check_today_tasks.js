import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    // Fetch tasks created today
    const { data: tasks, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
    
    if (error) {
      console.error(error)
      return
    }
    
    console.log(`Found ${tasks.length} recent tasks:`)
    tasks.forEach(t => {
      console.log(`\n- Task ID: ${t.id}, Step: "${t.step}", Status: "${t.status}", Created At: ${t.created_at}`)
      if (t.plan_snapshot) {
        console.log("  plan_snapshot parts:")
        Object.keys(t.plan_snapshot).forEach(k => {
          if (k !== 'materialSummary' && k !== '_metadata') {
            console.log(`    * Key: ${k}, Name: "${t.plan_snapshot[k].name}", Plan Qty: ${t.plan_snapshot[k].plan}`)
          }
        })
      }
    })
  }
  
  check()
}
