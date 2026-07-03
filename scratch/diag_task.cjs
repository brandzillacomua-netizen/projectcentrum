const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  const { data: orders } = await supabase.from('orders').select('*');
  const targetOrder = orders.find(o => String(o.order_num).includes('04072026'));
  console.log("Matched order:", targetOrder);

  if (targetOrder) {
    const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', targetOrder.id);
    console.log("Tasks for order:", tasks.map(t => ({ id: t.id, batch_index: t.batch_index })));
    for (const t of tasks) {
      const { data: reqs } = await supabase.from('material_requests').select('*').eq('task_id', t.id);
      console.log(`Reqs for task ${t.id} (batch ${t.batch_index}):`, reqs.map(r => ({ id: r.id, status: r.status, details: r.details, quantity: r.quantity })));
    }
  }
}

run();
