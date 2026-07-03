import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function main() {
  const { data, error } = await supabase.rpc('get_table_triggers', { table_name: 'tasks' });
  if (error) {
    // If rpc doesn't exist, query pg_trigger via standard query if possible, or execute custom SQL.
    // Since Supabase REST API doesn't support raw SQL query execution directly unless we have a specific RPC,
    // let's try a common query or check other sources.
    console.error('Trigger RPC error:', error);
    
    // Let's try to query pg_trigger through a function if we have any custom RPC,
    // or let's search code files for trigger creation or SQL migrations.
    return;
  }
  console.log('Triggers:', data);
}

main();
