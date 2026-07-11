require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await supabase.from('system_users').select('*');
  if (error) {
    console.error('Error fetching system users:', error);
    return;
  }
  
  console.log('--- SYSTEM USERS ---');
  data.forEach(u => {
    console.log(`ID: ${u.id} | Login: ${u.login} | Name: ${u.first_name} ${u.last_name} | Role: ${u.role} | Position: ${u.position} | Type: ${u.type}`);
  });
}

main();
