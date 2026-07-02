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
  const ids = [
    '4e7a81cd-c4c1-41ce-8bf8-3b1ef01b5929',
    'cfc03fb2-89d0-49bb-a1db-08cadb554c1c',
    'd23c9d7a-b46f-4e55-b372-57316a304dfc',
    '149fa7bc-1f2d-451c-af7f-923412c84fc8',
    '238e60b2-d749-4b8f-b367-c0bf7b63ef9b'
  ];
  const { data, error } = await supabase.from('work_cards')
    .select('id, created_at, started_at, completed_at')
    .in('id', ids);
  
  if (error) {
    console.error(error);
  } else {
    console.log(data);
  }
}

run();
