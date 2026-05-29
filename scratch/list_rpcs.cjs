const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log('Querying api spec:')
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
