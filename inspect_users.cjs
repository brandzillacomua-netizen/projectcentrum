const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase.from('system_users').select('id, login, first_name, last_name, position, access_rights');
  if (error) {
    console.error('Error fetching users:', error);
  } else {
    console.log('All Users:');
    data.forEach(u => {
      console.log(`- User: ${u.first_name} ${u.last_name} (${u.login}) | Position: ${u.position} | Access:`, u.access_rights);
    });
  }
}

run();
