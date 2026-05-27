const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql: `
      SELECT 
        tgname AS trigger_name,
        relname AS table_name,
        proname AS function_name
      FROM pg_trigger
      JOIN pg_class ON pg_class.oid = tgrelid
      JOIN pg_proc ON pg_proc.oid = tgfoid
      WHERE relname IN ('work_card_history', 'work_cards', 'inventory');
    ` });
    console.log('exec_sql result:', { data, error });
  } catch (e) {
    console.error('exec_sql caught error:', e);
  }
}

run();
