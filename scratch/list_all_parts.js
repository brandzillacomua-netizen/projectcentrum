import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const { data, error } = await supabase
      .from('nomenclatures')
      .select('*')
      .eq('type', 'part')
    
    if (error) {
      console.error(error)
      return
    }
    
    console.log(`Found ${data.length} total parts in nomenclatures:`)
    data.forEach(n => {
      // Check for homoglyphs or print clean names
      const hasCyrillic = /[а-яіїєґ]/i.test(n.name)
      const hasLatin = /[a-z]/i.test(n.name)
      console.log(`- ID: ${n.id}, Name: "${n.name}" (Cyrillic: ${hasCyrillic}, Latin: ${hasLatin})`)
    })
  }
  
  check()
}
