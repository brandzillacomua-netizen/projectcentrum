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

  // 1. Шукаємо картку
  const { data: cards, error: cErr } = await supabase
    .from('work_cards')
    .select('*')
    .eq('task_id', taskId)
    .eq('nomenclature_id', nomId)
    .eq('status', 'waiting-materials');

  if (cErr) {
    console.error('Помилка пошуку карток:', cErr);
    return;
  }

  console.log('===== ЗНАЙДЕНІ КАРТКИ В СТАТУСІ waiting-materials =====');
  cards.forEach(c => {
    console.log(`ID: ${c.id}`);
    console.log(`Qty: ${c.quantity}`);
    console.log(`Op: ${c.operation}`);
    console.log(`Status: ${c.status}`);
    console.log(`Info: ${c.card_info}`);
    console.log(`Created At: ${c.created_at}`);
    console.log('-----------------------------------------');
  });

  if (cards.length === 0) {
    console.log('Картку не знайдено.');
    return;
  }

  const targetCard = cards[0];

  // 2. Спробуємо знайти пов'язані записи у sheets_demands (або схожих таблицях)
  // Пошукаємо за card_id або task_id
  const { data: demands, error: dErr } = await supabase
    .from('sheets_demands')
    .select('*')
    .eq('task_id', taskId);

  if (dErr) {
    console.log('Помилка пошуку в sheets_demands (можливо таблиця не існує):', dErr.message);
  } else {
    console.log('===== ЗАПИСИ В sheets_demands ДЛЯ ЦЬОГО НАРЯДУ =====');
    demands.forEach(d => {
      console.log(`ID: ${d.id}, Nom: ${d.nomenclature_id}, Sheets: ${d.sheets_qty || d.sheets_count || d.quantity}, Status: ${d.status}, Info: ${d.info || d.card_info || d.note}`);
    });
  }

  // Пошукаємо також у supply_orders або подібних таблицях, якщо sheets_demands немає
  const { data: tables, error: tErr } = await supabase
    .from('material_requests')
    .select('*')
    .eq('task_id', taskId);

  if (!tErr && tables) {
    console.log('===== ЗАПИСИ В material_requests =====');
    tables.forEach(m => {
      console.log(`ID: ${m.id}, Qty: ${m.quantity || m.sheets_qty}, Status: ${m.status}`);
    });
  }
}

run();
