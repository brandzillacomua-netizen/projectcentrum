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
  const nomId = 'b77e0883-0af2-40a4-a834-a1e47b6570da'; // Київ К-ІП9-10-П-7-46

  // 1. Знаходимо картку
  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('task_id', taskId)
    .eq('nomenclature_id', nomId)
    .eq('status', 'waiting-materials')
    .eq('quantity', 46);

  console.log('===== КАРТКА waiting-materials 46 шт =====');
  if (!cards || cards.length === 0) {
    console.log('Не знайдено!');
    return;
  }
  const card = cards[0];
  console.log(card);

  // 2. Шукаємо в sheets_demands запис, що очікує матеріалу
  // Пошукаємо за nomenclature_id та статусом pending
  const { data: demands } = await supabase
    .from('sheets_demands')
    .select('*')
    .eq('task_id', taskId)
    .eq('nomenclature_id', nomId)
    .eq('status', 'pending');

  console.log('\n===== ЗАПИТИ В sheets_demands В СТАТУСІ pending =====');
  console.log(demands);
}

run();
