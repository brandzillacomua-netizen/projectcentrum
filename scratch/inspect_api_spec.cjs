const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const check = async () => {
    const url = `${urlMatch[1]}/rest/v1/`;
    console.log('Fetching spec from:', url)
    const response = await fetch(url, {
      headers: {
        'apikey': keyMatch[1],
        'Authorization': `Bearer ${keyMatch[1]}`
      }
    })
    const apiSpec = await response.json()
    console.log('API Spec:', apiSpec)
  }
  check()
} else {
  console.error('Could not find Supabase credentials')
}
