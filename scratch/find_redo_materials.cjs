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
  const taskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e';

  // Шукаємо в material_requests
  const { data: requests } = await supabase
    .from('material_requests')
    .select('*')
    .eq('task_id', taskId);

  console.log('===== ЗАПИСИ material_requests ДЛЯ НАРЯДУ =====');
  requests.forEach(r => {
    if (r.details && (r.details.includes('ДОЗАПИТ') || r.details.includes('ДОВИПУСК') || r.details.includes('БРАК'))) {
      console.log(r);
    }
  });
}

run();
