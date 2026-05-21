import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Fetching triggers...")
    const { data: triggers, error } = await supabase.rpc('get_triggers')
    if (error) {
      console.log("Error fetching triggers directly, trying trigger query...")
      const { data: trig2, error: err2 } = await supabase.from('pg_trigger').select('*')
      console.log("Triggers:", trig2 ? trig2.length : 0)
    } else {
      console.log("Triggers count:", triggers?.length)
      console.log(JSON.stringify(triggers, null, 2))
    }
    
    // Let's also check if there is an edge function or a trigger function by querying pg_proc
    const { data: procs, error: err3 } = await supabase.rpc('get_procedures')
    console.log("Procedures:", procs ? procs.length : 0)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials in src/supabase.js')
}
