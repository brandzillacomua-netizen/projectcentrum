import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking machines table for 'тест':")
    const { data: machs } = await supabase.from('machines').select('*')
    console.log("Machines count:", machs?.length)
    console.log(machs)
    
    console.log("Checking work_cards table for 'тест':")
    const { data: cards } = await supabase.from('work_cards').select('id, machine, card_info').ilike('machine', '%тест%')
    console.log("Found work cards:", cards)
    
    console.log("Checking tasks table for 'тест' in plan_snapshot:")
    const { data: tasks } = await supabase.from('tasks').select('id, plan_snapshot')
    let foundInSnapshot = []
    tasks?.forEach(t => {
      const snapStr = JSON.stringify(t.plan_snapshot)
      if (snapStr.includes('тест')) {
        foundInSnapshot.push(t.id)
      }
    })
    console.log("Tasks with 'тест' in snapshot:", foundInSnapshot)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
