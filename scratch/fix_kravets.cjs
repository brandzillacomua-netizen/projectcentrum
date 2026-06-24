const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function run() {
  // Знайти in-progress картки Розкрій для перегляду
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id,operator_name,started_at,status,operation,shift_name')
    .eq('status', 'in-progress')
    .eq('operation', 'Розкрій');

  console.log('Активні Розкрій картки:');
  cards.forEach(c => {
    const startedAt = new Date(c.started_at);
    const kyivTime = startedAt.toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });
    console.log(`  ${c.id.slice(-8)} | ${c.operator_name} | started_at: ${c.started_at} (Київ: ${kyivTime})`);
  });

  // Виправити started_at для Кравець Тарас: 17:44 Київ = 14:44 UTC
  const kravetsCard = cards.find(c => c.operator_name && c.operator_name.includes('Кравець'));
  if (kravetsCard) {
    const correctStartedAt = '2026-06-24T14:44:00.000Z'; // 17:44 Київ
    console.log(`\nВиправлення Кравець Тарас (${kravetsCard.id.slice(-8)}): started_at -> ${correctStartedAt}`);
    const { error } = await supabase
      .from('work_cards')
      .update({ started_at: correctStartedAt })
      .eq('id', kravetsCard.id);
    if (error) console.error('Помилка:', error);
    else console.log('✓ Виправлено!');
  } else {
    console.log('\nКравець Тарас не знайдений серед in-progress карток');
    console.log('Можливо оператор на іншій картці або ім\'я трохи відрізняється');
  }
}

run().catch(console.error);
