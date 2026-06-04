import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    // List tables
    const tables = [
      'nomenclatures',
      'tasks',
      'orders',
      'order_items',
      'packaging_boxes',
      'work_cards'
    ]

    for (const table of tables) {
      const { data, error } = await supabase.from(table).select('*').limit(20)
      if (error) {
        console.error(`Error on table ${table}:`, error.message)
        continue
      }
      
      const str = JSON.stringify(data)
      if (str.includes('Верхня пластина') || str.includes('ІП-72-F5-В-3-45')) {
        console.log(`FOUND in table ${table}!`)
        // Let's print the specific row that has it
        const matching = data.filter(row => JSON.stringify(row).includes('Верхня пластина') || JSON.stringify(row).includes('ІП-72-F5-В-3-45'))
        console.log(JSON.stringify(matching, null, 2))
      }
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
