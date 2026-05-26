const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking triggers on work_cards:")
    const sql = `
      SELECT 
        tgname AS trigger_name,
        proname AS function_name,
        prosrc AS function_source
      FROM pg_trigger
      JOIN pg_proc ON pg_proc.oid = tgfoid
      WHERE tgrelid = 'work_cards'::regclass;
    `;
    const { data, error } = await supabase.rpc('exec_sql', { sql })
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
