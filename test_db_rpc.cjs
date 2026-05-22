const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Let's test if we can do upsert with start_page column to see if it already exists or if it fails
  const { data, error } = await supabase.from('company_positions').insert([{ name: 'Test Start Page', start_page: '/test' }]).select();
  console.log('Insert test result:', { data, error });
  if (data && data.length > 0) {
    // Delete it
    await supabase.from('company_positions').delete().eq('id', data[0].id);
  }
}

run();
