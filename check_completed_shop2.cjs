const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const nums = ['27062026-01', '25062026-02', '29062026-01'];
  
  for (const n of nums) {
    const { data: orders } = await supabase.from('orders').select('id, order_num').ilike('order_num', `%${n}%`);
    if (!orders || orders.length === 0) continue;
    const orderId = orders[0].id;
    const { data: tasks } = await supabase.from('tasks').select('id').eq('order_id', orderId);
    const taskIds = tasks.map(t => t.id);

    const { data: cards } = await supabase.from('work_cards').select('*').in('task_id', taskIds);
    const completedShop2 = cards.filter(c => {
      const op = (c.operation || '').toLowerCase();
      const isShop2 = ['пресування', 'фарбування', 'малярка', 'доопрацювання', 'пакування', 'сгп'].some(o => op.includes(o));
      return isShop2 && c.status === 'completed';
    });
    console.log(`\nOrder: ${n} | Total completed Shop 2 cards: ${completedShop2.length}`);
    completedShop2.forEach(c => {
      console.log(`  Card: ${c.id} | Nom: ${c.nomenclature_id} | Op: ${c.operation} | Qty: ${c.quantity}`);
    });
  }
}

run();
