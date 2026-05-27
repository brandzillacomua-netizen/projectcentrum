import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying pg_catalog.pg_proc or routines via RPC list:')
    // We can query pg_description or pg_proc? No, PostgREST doesn't expose it unless exposed.
    // Let's see if there is any function in the schema cache by trying a request to the API directly.
    const response = await fetch(`${urlMatch[1]}/rest/v1/`, {
      headers: {
        'apikey': keyMatch[1],
        'Authorization': `Bearer ${keyMatch[1]}`
      }
    })
    const apiSpec = await response.json()
    console.log('Available paths/functions in API spec:')
    if (apiSpec.paths) {
      Object.keys(apiSpec.paths).forEach(p => {
        if (p.startsWith('/rpc/')) {
          console.log(`- RPC: ${p}`)
        }
      })
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
