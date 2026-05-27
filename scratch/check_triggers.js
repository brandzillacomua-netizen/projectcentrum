import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying pg_trigger to see if there are triggers on work_card_history or inventory:')
    
    // We can run arbitrary SQL using RPC if there is one, or let's see if we can query pg_catalog tables via REST
    // Supabase allows querying pg_catalog if permissions are set, let's try:
    const { data, error } = await supabase
      .from('work_card_history')
      .select('count')
      .limit(1)
      
    // Let's run a query on pg_trigger using an RPC if available
    const { data: triggers, error: triggerError } = await supabase
      .rpc('get_triggers_info') // just in case
      
    console.log('Triggers error (expected if no RPC):', triggerError)
    console.log('Triggers data:', triggers)
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
