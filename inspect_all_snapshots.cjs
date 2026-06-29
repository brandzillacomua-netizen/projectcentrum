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
  const nums = ['27062026-01', '25062026-02', '22062026-03', '29062026-01'];
  
  for (const n of nums) {
    const { data: orders } = await supabase.from('orders').select('id, order_num').ilike('order_num', `%${n}%`);
    if (!orders || orders.length === 0) {
      console.log(`No order for ${n}`);
      continue;
    }
    const orderId = orders[0].id;
    const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId);
    console.log(`\n================ ${n} ================`);
    tasks.forEach(t => {
      console.log(`Task ID: ${t.id} | Step: ${t.step} | Status: ${t.status}`);
      const snapshot = t.plan_snapshot || {};
      Object.entries(snapshot).forEach(([k, v]) => {
        if (k.length > 20) {
          console.log(`  Nom ${k}: stock=${v.stock}, need=${v.need}, plan=${v.plan}`);
        }
      });
    });
  }
}

run();
