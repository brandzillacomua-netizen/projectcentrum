const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseFile = fs.readFileSync('a:/centrum/src/supabase.js', 'utf8')
const urlMatch = supabaseFile.match(/const supabaseUrl = ['"](.+?)['"]/)
const keyMatch = supabaseFile.match(/const supabaseAnonKey = ['"](.+?)['"]/)

if (urlMatch && keyMatch) {
  const supabase = createClient(urlMatch[1], keyMatch[1])
  
  const check = async () => {
    console.log("Checking triggers on all tables:")
    const sql = `
      SELECT 
        c.relname AS table_name,
        t.tgname AS trigger_name,
        p.proname AS function_name,
        p.prosrc AS function_source
      FROM pg_trigger t
      JOIN pg_class c ON c.oid = t.tgrelid
      JOIN pg_proc p ON p.oid = t.tgfoid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public';
    `;
    const { data, error } = await supabase.rpc('exec_sql', { sql })
    if (error) {
      console.error('RPC Error:', error)
    } else {
      console.log('Triggers found:')
      for (const row of data || []) {
        console.log(`Table: "${row.table_name}" | Trigger: "${row.trigger_name}" | Function: "${row.function_name}"`)
        if (row.function_source && row.function_source.includes('http')) {
          console.log(`  Source contains HTTP/cURL call!`)
        }
      }
    }
  }
  
  check()
} else {
  console.error('Could not find Supabase credentials')
}
