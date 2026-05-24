import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data: inv, error } = await supabase.from('inventory').select('*')
    if (error) {
      console.error(error)
      return
    }
    console.log("All inventory items:")
    inv.forEach(i => {
      if (i.total_qty > 0) {
        console.log(`- ID: ${i.id}, NomID: ${i.nomenclature_id}, Name: ${i.name}, Type: ${i.type}, Qty: ${i.total_qty}`)
      }
    })
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
