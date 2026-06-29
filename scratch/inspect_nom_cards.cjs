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
  const nomId = 'a1945ab8-a15d-4f11-9a7c-619cd30bc8f7'; // Київ К-ІП9/10/31/36/37-9-10-11-Х-3-39 (або знайдемо за назвою)

  // Знайдемо id за назвою
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .ilike('name', '%-Х-3-39%');

  if (!noms || noms.length === 0) {
    console.log('Номенклатуру не знайдено');
    return;
  }
  const targetNomId = noms[0].id;
  console.log(`Аналізуємо картки для деталі: ${noms[0].name} (ID: ${targetNomId})`);

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, nomenclature_id, quantity, operation, status, card_info')
    .eq('task_id', taskId)
    .eq('nomenclature_id', targetNomId);

  console.log(`Знайдено карток: ${cards.length}`);
  cards.forEach((c, idx) => {
    console.log(`- Картка ${idx + 1}: ID=${c.id}, Qty=${c.quantity}, Op="${c.operation}", Status="${c.status}", Info="${c.card_info}"`);
  });
}

run();
