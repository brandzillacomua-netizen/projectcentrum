const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

const sql = fs.readFileSync('a:/centrum/scratch/redesign_nomenclatures.sql', 'utf8');

async function run() {
  console.log("Attempting migration with parameter { sql: ... }");
  let res = await supabase.rpc('exec_sql', { sql: sql });
  console.log("Result (sql):", res);
  
  if (res.error) {
    console.log("Attempting migration with parameter { query: ... }");
    res = await supabase.rpc('exec_sql', { query: sql });
    console.log("Result (query):", res);
  }

  if (res.error) {
    console.log("Attempting migration with parameter { sql_query: ... }");
    res = await supabase.rpc('exec_sql', { sql_query: sql });
    console.log("Result (sql_query):", res);
  }
}

run();
