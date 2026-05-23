const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data: policies, error: polError } = await supabase.rpc('exec_sql', {
      sql: "SELECT * FROM pg_policies WHERE tablename = 'machine_operations';"
    });
    console.log('Policies on machine_operations:', { polError, policies });

    const { data: rlsStatus, error: rlsError } = await supabase.rpc('exec_sql', {
      sql: "SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'machine_operations';"
    });
    console.log('RLS Status on machine_operations:', { rlsError, rlsStatus });

    const { data: rows, error: rowError } = await supabase.from('machine_operations').select('*').limit(5);
    console.log('Direct select count:', rows ? rows.length : 0, 'error:', rowError);
  } catch (e) {
    console.error('Caught error:', e);
  }
}

run();
