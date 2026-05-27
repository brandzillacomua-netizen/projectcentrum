import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    const nomId = 'a3498c79-c914-4526-8abf-a56fd0735794'
    console.log('Testing insert for F610-ІП24-В-3-15 scrap in inventory:')
    const { data, error } = await supabase.from('inventory').insert([{
      name: 'F610-ІП24-В-3-15',
      unit: 'шт',
      total_qty: 16,
      type: 'scrap',
      nomenclature_id: nomId
    }]).select()
    
    console.log('Result:', { data, error })
    if (data && data.length > 0) {
      // clean up
      await supabase.from('inventory').delete().eq('id', data[0].id)
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
