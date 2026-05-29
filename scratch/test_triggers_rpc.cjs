const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Calling get_triggers:")
    const { data, error } = await supabase.rpc('get_triggers')
    if (error) {
      console.error('RPC Error:', error)
    } else {
      console.log('Triggers found:', JSON.stringify(data, null, 2))
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
