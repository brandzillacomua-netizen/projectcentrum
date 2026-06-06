const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking all triggers in DB (using query):")
    const sql = `
      SELECT 
        tgname AS trigger_name,
        relname AS table_name,
        proname AS function_name
      FROM pg_trigger
      JOIN pg_class ON pg_class.oid = tgrelid
      JOIN pg_proc ON pg_proc.oid = tgfoid
      WHERE tgisinternal = false;
    `;
    // Try passing the parameter as 'query' instead of 'sql'
    const { data, error } = await supabase.rpc('exec_sql', { query: sql })
    if (error) {
      console.error('RPC Error (query):', error)
      // Try passing the parameter as 'sql_query'
      const { data: data2, error: error2 } = await supabase.rpc('exec_sql', { sql_query: sql })
      if (error2) {
        console.error('RPC Error (sql_query):', error2)
      } else {
        console.log('Triggers found (sql_query):', data2)
      }
    } else {
      console.log('Triggers found (query):', data)
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
