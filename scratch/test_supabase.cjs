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

async function run() {
  const { data, error } = await supabase
    .from('scrap_classifications')
    .select('*')
    .limit(1);

  if (error) {
    console.error('scrap_classifications table error:', error.message);
  } else {
    console.log('scrap_classifications table exists! Fetched sample:', data);
  }

  const { data: su, error: suErr } = await supabase
    .from('scrap_reasons')
    .select('id, name')
    .limit(5);
  console.log('scrap_reasons:', su || suErr);
}

run();
