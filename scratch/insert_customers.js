import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const insert = async () => {
    console.log("Inserting missing customers...")
    const customers = [
      { name: 'ТОВ "ДзюнькаПісюнька"', official_name: 'ТОВ "ДзюнькаПісюнька"' },
      { name: 'ТОВ ПІСЮНЬКА2', official_name: 'ТОВ ПІСЮНЬКА2' }
    ]

    for (const c of customers) {
      const { data: existing } = await supabase.from('customers').select('id').ilike('name', c.name).maybeSingle()
      if (!existing) {
        const { data, error } = await supabase.from('customers').insert([c]).select()
        if (error) {
          console.error(`Error inserting ${c.name}:`, error.message)
        } else {
          console.log(`Inserted: ${c.name}`, data)
        }
      } else {
        console.log(`Already exists: ${c.name}`)
      }
    }
  }
  
  insert()
} else {
  console.error('Could not find Supabase credentials')
}
