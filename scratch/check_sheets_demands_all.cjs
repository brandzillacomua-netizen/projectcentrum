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

  const { data: demands, error } = await supabase
    .from('sheets_demands')
    .select('*')
    .eq('task_id', taskId);

  if (error) {
    console.error(error);
    return;
  }

  // Отримаємо також назви номенклатур
  const nomIds = [...new Set(demands.map(d => d.nomenclature_id).filter(Boolean))];
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .in('id', nomIds);

  const nomMap = {};
  noms.forEach(n => {
    nomMap[n.id] = n;
  });

  console.log('===== УСІ ЗАПИСИ sheets_demands ДЛЯ ЦЬОГО НАРЯДУ =====');
  demands.forEach(d => {
    const nomName = nomMap[d.nomenclature_id]?.name || 'Невідома';
    console.log(`ID: ${d.id}, Nom: ${nomName}, Sheets: ${d.sheets_qty}, Status: ${d.status}, Info: ${d.card_info || d.info || d.note}`);
  });
}

run();
