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
  console.log('Пошук залишків на СГП для деталей наряду 22062026-03...');

  // 1. Отримаємо деталі наряду
  const taskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e';
  const { data: cards } = await supabase
    .from('work_cards')
    .select('nomenclature_id')
    .eq('task_id', taskId);

  const nomIds = [...new Set(cards.map(c => c.nomenclature_id).filter(Boolean))];

  if (nomIds.length === 0) {
    console.log('Не знайдено деталей для цього наряду.');
    return;
  }

  // 2. Отримаємо назви деталей
  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name')
    .in('id', nomIds);

  const nomMap = {};
  noms.forEach(n => {
    nomMap[n.id] = n;
  });

  // 3. Запитаємо залишки в inventory
  const { data: inv, error } = await supabase
    .from('inventory')
    .select('*')
    .in('nomenclature_id', nomIds);

  if (error) {
    console.error('Помилка завантаження інвентарю:', error);
    return;
  }

  console.log('\n===== ЗАЛИШКИ НА СГП (СКЛАД ГОТОВОЇ ПРОДУКЦІЇ) =====');
  
  nomIds.forEach(nid => {
    const nom = nomMap[nid] || { name: 'Невідома деталь' };
    const items = inv.filter(i => 
      String(i.nomenclature_id) === String(nid) && 
      (i.type === 'finished' || String(i.warehouse).toLowerCase() === 'sgp')
    );

    const totalSGP = items.reduce((sum, i) => sum + (Number(i.total_qty) || 0), 0);
    console.log(`\nДеталь: ${nom.name}`);
    console.log(`Кількість на СГП: ${totalSGP} шт.`);
    if (items.length > 0) {
      console.log('Деталізація записів:');
      items.forEach(item => {
        console.log(`  - Склад: ${item.warehouse}, Тип: ${item.type}, К-сть: ${item.total_qty} шт.`);
      });
    }
  });
}

run();
