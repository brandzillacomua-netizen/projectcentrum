import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Fetching system_users...")
    const { data: users, error: uErr } = await supabase.from('system_users').select('*')
    if (uErr) {
      console.error(uErr)
    } else {
      console.log("System Users:")
      users.forEach(u => {
        console.log(`- Login: ${u.login}, Name: ${u.first_name} ${u.last_name}, Department: ${u.department}, Position: ${u.position}, Shift: ${u.shift}`)
      })
    }

    console.log("\nFetching company_structure...")
    const { data: structure, error: sErr } = await supabase.from('company_structure').select('*')
    if (sErr) {
      console.error(sErr)
    } else {
      console.log("Company Structure:")
      structure.forEach(s => {
        console.log(`- Name: ${s.name}, Type: ${s.type}`)
      })
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
