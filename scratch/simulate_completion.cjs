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
  if (card.status === 'completed') return true;
  if (card.status === 'at-shop2-buffer') return true;
  return false;
};

async function run() {
  console.log('Завантаження даних для наряду 22062026-03...');
  
  const { data: orders } = await supabase
    .from('orders')
    .select('id, order_num')
    .eq('order_num', '22062026-03');

  if (!orders || orders.length === 0) return;
  const order = orders[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, step, status')
    .eq('order_id', order.id);

  const taskIds = tasks.map(t => t.id);

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, quantity, operation, status')
    .in('task_id', taskIds);

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
        pendingCards: 0
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
  });

  console.log('\n===== СИМУЛЯЦІЯ ЗАВЕРШЕННЯ КАРТОК (БЕЗ НОВОГО БРАКУ) =====');
  Object.entries(stats).forEach(([nid, stat]) => {
    const nom = nomMap[nid] || { name: 'Невідома деталь' };
    console.log(`\nДеталь: ${nom.name}`);
    console.log(`- Вже вироблено (прийнято/буфер): ${stat.produced} шт.`);
    console.log(`- В процесі (незавершені картки): ${stat.pending} шт. (у ${stat.pendingCards} картках)`);
    console.log(`- Очікувана фінальна кількість деталей: ${stat.produced + stat.pending} шт.`);
  });
}

run();
