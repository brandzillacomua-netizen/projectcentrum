import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking system_users table...")
    const { data: users, error } = await supabase.from('system_users').select('*')
    if (error) {
      console.error(error)
      return
    }
    console.log("Total users:", users.length)
    const positions = new Set()
    const deptPositions = {}
    users.forEach(u => {
      if (u.position) {
        positions.add(u.position)
        if (!deptPositions[u.department]) {
          deptPositions[u.department] = new Set()
        }
        deptPositions[u.department].add(u.position)
      }
    })
    console.log("Positions:")
    console.log(Array.from(positions))
    console.log("Departments & Positions:")
    Object.keys(deptPositions).forEach(d => {
      console.log(` - ${d}:`, Array.from(deptPositions[d]))
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
