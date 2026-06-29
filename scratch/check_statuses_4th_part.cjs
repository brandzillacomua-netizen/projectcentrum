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
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .ilike('name', '%-П-7-46%');

  if (!noms || noms.length === 0) {
    console.log('Номенклатуру не знайдено');
    return;
  }

  const nomId = noms[0].id;
  console.log(`Знайдено номенклатуру: ${noms[0].name} (ID: ${nomId})`);

  const { data: cards } = await supabase
    .from('work_cards')
    .select('status, quantity, operation')
    .eq('task_id', taskId)
    .eq('nomenclature_id', nomId);

  const summary = {};
  cards.forEach(c => {
    const key = `${c.operation} / ${c.status}`;
    summary[key] = (summary[key] || 0) + (Number(c.quantity) || 0);
  });

  console.log('===== СУМА КАРТОК ЗА СТАТУСАМИ =====');
  Object.entries(summary).forEach(([k, val]) => {
    console.log(`${k}: ${val} шт.`);
  });
}

run();
