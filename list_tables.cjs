const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Let's try to query database schemas or functions
  const { data: tables, error: tablesErr } = await supabase.from('pg_catalog.pg_tables').select('*');
  console.log('Tables from pg_catalog:', { error: tablesErr ? tablesErr.message : null, count: tables ? tables.length : 0 });
  
  // Let's see if we can query from a generic "settings" table
  const { data: settings, error: settingsErr } = await supabase.from('settings').select('*');
  console.log('settings table:', { error: settingsErr ? settingsErr.message : null, data: settings });

  const { data: system_settings, error: sysErr } = await supabase.from('system_settings').select('*');
  console.log('system_settings table:', { error: sysErr ? sysErr.message : null, data: system_settings });
}

run();
