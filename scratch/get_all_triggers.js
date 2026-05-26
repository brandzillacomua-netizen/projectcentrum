import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('A:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking DB triggers...")
    const { data, error } = await supabase.rpc('get_triggers')
    if (error) {
      // Try raw sql query via standard table or info schema if RPC is not defined
      console.log("RPC get_triggers failed/not found, querying pg_trigger...")
      const { data: rawTriggers, error: rawError } = await supabase
        .from('pg_trigger')
        .select('tgname, tgrelid::regclass, tgtype')
      if (rawError) {
        console.error("Failed to query pg_trigger:", rawError)
      } else {
        console.log("Raw pg_trigger rows:", rawTriggers)
      }
    } else {
      console.log("Triggers:", data)
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
