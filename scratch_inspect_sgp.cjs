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
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .eq('order_num', '22062026-03');

  if (!orders || orders.length === 0) {
    console.log('No order found.');
    return;
  }
  const order = orders[0];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', order.id);

  const taskIds = tasks.map(t => t.id);

  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .in('task_id', taskIds);

  console.log('--- ALL CARDS FOR ORDER 22062026-03 ---');
  cards.forEach(c => {
    console.log(`Card ID: ${c.id} | Nom: ${c.nomenclature_id} | Op: ${c.operation} | Status: ${c.status} | Qty: ${c.quantity}`);
  });

  console.log('\n--- TASKS FOR ORDER 22062026-03 ---');
  tasks.forEach(t => {
    console.log(`Task ID: ${t.id} | Step: ${t.step} | Status: ${t.status} | plan_snapshot keys count: ${Object.keys(t.plan_snapshot || {}).length}`);
  });
}

run();
