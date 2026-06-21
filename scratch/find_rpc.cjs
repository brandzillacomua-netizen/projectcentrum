const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

const names = ['exec_sql', 'execute_sql', 'run_sql', 'sql', 'query', 'run_query', 'execute_query', 'db_sql', 'exec_query'];

async function testAll() {
  for (const name of names) {
    const { data, error } = await supabase.rpc(name, { sql: 'SELECT 1' });
    console.log(`rpc('${name}', { sql: ... }):`, { error: error ? error.message : null, hasData: !!data });
    
    const { data: dataQ, error: errorQ } = await supabase.rpc(name, { query: 'SELECT 1' });
    console.log(`rpc('${name}', { query: ... }):`, { error: errorQ ? errorQ.message : null, hasData: !!dataQ });
  }
}

testAll();
