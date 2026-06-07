import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1], {
    global: {
      headers: {
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }
  })

  const run = async () => {
    console.log("--- Querying RLS status of tables ---")
    const { data: tables, error: err1 } = await supabase.rpc('get_tables_rls_status')
    if (err1) {
      console.error("Error calling get_tables_rls_status:", err1.message)
      console.log("Tip: Make sure you ran supabase/create_inspect_functions.sql in Supabase SQL Editor.")
    } else {
      console.table(tables)
    }

    console.log("\n--- Querying active policies ---")
    const { data: policies, error: err2 } = await supabase.rpc('get_all_policies')
    if (err2) {
      console.error("Error calling get_all_policies:", err2.message)
    } else {
      console.table(policies)
    }
  }

  run()
} else {
  console.error("Could not find Supabase credentials")
}
