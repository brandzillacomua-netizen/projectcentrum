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

async function run() {
  console.log("--- Checking active RLS on public tables ---");
  const { data: tables, error: err1 } = await supabase.rpc('exec_sql', {
    sql: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
  });
  if (err1) console.error("Error checking tables:", err1);
  else console.table(tables);

  console.log("--- Checking policies ---");
  const { data: policies, error: err2 } = await supabase.rpc('exec_sql', {
    sql: `SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check FROM pg_policies WHERE schemaname = 'public';`
  });
  if (err2) console.error("Error checking policies:", err2);
  else console.table(policies);
}

run();
