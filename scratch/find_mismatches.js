import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data: noms } = await supabase.from('nomenclatures').select('*')
    const { data: bom } = await supabase.from('bom_items').select('*')
    
    console.log("=== Checking BOM Link Mismatches ===")
    
    for (const link of bom) {
      const parent = noms.find(n => n.id === link.parent_id)
      const child = noms.find(n => n.id === link.child_id)
      
      if (!parent || !child) continue
      
      // If parent has 218 but child has 210
      if (parent.name.includes('218') && child.name.includes('210')) {
        console.log(`Mismatch: Parent "${parent.name}" has 218, but Child "${child.name}" has 210! (Link ID: ${link.id})`)
      }
      
      // If parent has 210 but child has 218
      if (parent.name.includes('210') && child.name.includes('218')) {
        console.log(`Mismatch: Parent "${parent.name}" has 210, but Child "${child.name}" has 218! (Link ID: ${link.id})`)
      }
    }
  }
  
  check()
}
