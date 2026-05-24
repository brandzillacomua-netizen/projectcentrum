const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const { data: users, error } = await supabase
    .from('system_users')
    .select('*');

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  console.log('Total users:', users.length);
  users.forEach(u => {
    console.log(`Name: ${u.first_name} ${u.last_name} | Login: ${u.login} | Dept: "${u.department}" | Shift: "${u.shift}" | Pos: "${u.position}"`);
  });
}

main();
