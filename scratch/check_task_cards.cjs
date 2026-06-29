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

const countAsProduced = (card) => {
  return card.status === 'completed' || card.status === 'at-shop2-buffer' || card.status === 'waiting-buffer';
};

async function run() {
  const taskId = 'c7055204-cbad-4f74-bae6-4a8a79c14b7e'; // Наряд розкрою
  console.log(`Аналіз карток для наряду розкрою: ${taskId}`);

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, quantity, operation, status')
    .eq('task_id', taskId);

  const { data: noms } = await supabase
    .from('nomenclatures')
    .select('id, name');

  const nomMap = {};
  noms.forEach(n => {
    nomMap[n.id] = n;
  });

  const stats = {};

  cards.forEach(card => {
    const nid = card.nomenclature_id;
    if (!nid) return;

    if (!stats[nid]) {
      stats[nid] = {
        produced: 0,
        pending: 0,
        totalCards: 0,
        pendingCards: 0,
        details: []
      };
    }

    const qty = Number(card.quantity) || 0;
    stats[nid].totalCards++;

    if (countAsProduced(card)) {
      stats[nid].produced += qty;
    } else {
      stats[nid].pending += qty;
      stats[nid].pendingCards++;
    }
    stats[nid].details.push({ status: card.status, qty, op: card.operation });
  });

  console.log('\n===== РЕЗУЛЬТАТИ ДЛЯ НАРЯДУ РОЗКРОЮ =====');
  Object.entries(stats).forEach(([nid, stat]) => {
    const nom = nomMap[nid] || { name: 'Невідома деталь' };
    console.log(`\nДеталь: ${nom.name}`);
    console.log(`- Всього карток: ${stat.totalCards}`);
    console.log(`- Вже вироблено: ${stat.produced} шт.`);
    console.log(`- В процесі: ${stat.pending} шт. (у ${stat.pendingCards} картках)`);
    
    // Покажемо перші 5 карток в процесі
    const pendingList = stat.details.filter(d => !countAsProduced({status: d.status}));
    console.log(`- Зразок незавершених карток (показано 5 з ${pendingList.length}):`);
    pendingList.slice(0, 5).forEach(c => {
      console.log(`  * Етап: ${c.op}, Статус: ${c.status}, К-сть: ${c.qty} шт.`);
    });
  });
}

run();
