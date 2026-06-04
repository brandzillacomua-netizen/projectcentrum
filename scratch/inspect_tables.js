import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    // List tables using public schema info
    // Let's query a known nomenclature item first, e.g. 'ІП-72-F5-В-3-45'
    console.log("Querying nomenclature 'ІП-72-F5-В-3-45':")
    const { data: nom, error: err1 } = await supabase
      .from('nomenclatures')
      .select('*')
      .eq('name', 'ІП-72-F5-В-3-45')
    console.log("Nom data:", nom, err1)

    // Let's query order_items or task items to see how they are structured
    console.log("Querying order_items:")
    const { data: orderItems, error: err2 } = await supabase
      .from('order_items')
      .select('*')
      .limit(5)
    console.log("Order items:", orderItems, err2)

    // Let's query specifications or related tables if they exist
    const { data: specs, error: err3 } = await supabase
      .from('specifications')
      .select('*')
      .limit(5)
    console.log("Specifications:", specs, err3)

    // Let's search for the string "Верхня пластина" in all table data or in a specific schema query if we can
    // Or we can search for it in order_items or similar
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
