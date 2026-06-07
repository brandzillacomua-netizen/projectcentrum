import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const check = async () => {
    const response = await fetch(`${urlMatch[1]}/rest/v1/`, {
      headers: {
        'apikey': keyMatch[1],
        'Authorization': `Bearer ${keyMatch[1]}`
      }
    })
    const apiSpec = await response.json()
    console.log("Keys in apiSpec:", Object.keys(apiSpec));
    if (apiSpec.paths) {
      fs.writeFileSync('a:/centrum/scratch/openapi_spec_full.json', JSON.stringify(apiSpec.paths, null, 2));
      console.log("Saved openapi paths to scratch/openapi_spec_full.json. Total paths:", Object.keys(apiSpec.paths).length);
    } else {
      console.log("No paths found. apiSpec:", apiSpec);
    }
  }
  check()
}
