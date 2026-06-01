import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const url = urlMatch[1]
  const key = keyMatch[1]
  const check = async () => {
    try {
      const response = await fetch(`${url}/rest/v1/`, {
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`
        }
      })
      const apiSpec = await response.json()
      fs.writeFileSync('a:/centrum/scratch/openapi_spec.json', JSON.stringify(apiSpec, null, 2))
      console.log('Saved OpenAPI spec to scratch/openapi_spec.json. Paths:')
      if (apiSpec.paths) {
        Object.keys(apiSpec.paths).forEach(p => {
          if (p.startsWith('/rpc/')) {
            console.log(`- RPC: ${p}`)
          }
        })
      }
    } catch (err) {
      console.error('Fetch spec failed:', err)
    }
  }
  check()
} else {
  console.error('Could not find Supabase credentials')
}
