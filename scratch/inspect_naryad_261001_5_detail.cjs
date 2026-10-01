const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function inspectNaryad() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  console.log('=== SEARCHING FOR ORDERS / TASKS CREATED TODAY (2026-10-01) ===');

  // Search order by order_num 261001-5 or similar
  const { data: orders } = await supabase
    .from('orders')
    .select('*')
    .or('order_num.ilike.%261001-5%,order_num.ilike.%261001%');

  console.log('Matching orders:', orders?.map(o => ({ id: o.id, order_num: o.order_num, created_at: o.created_at })));

  // Search tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .gte('created_at', '2026-10-01T10:00:00')
    .order('created_at', { ascending: false });

  console.log(`Found ${tasks?.length || 0} tasks created today.`);
  for (const t of tasks || []) {
    console.log(`Task ID: ${t.id} | Order ID: ${t.order_id} | Step: ${t.step} | Machine: ${t.machine_name} | CreatedAt: ${t.created_at}`);
    console.log('  plan_snapshot keys:', Object.keys(t.plan_snapshot || {}));
    console.log('  materialSummary:', JSON.stringify(t.plan_snapshot?.materialSummary || {}));
  }

  // Search work_cards created today
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, card_number, task_id, nomenclature_id, operation, quantity, created_at')
    .gte('created_at', '2026-10-01T10:00:00')
    .order('created_at', { ascending: false });

  console.log(`\nFound ${cards?.length || 0} work cards created today:`);
  cards?.forEach(c => console.log(`  Card: ${c.card_number} | Op: ${c.operation} | Qty: ${c.quantity} | TaskId: ${c.task_id}`));

  // Search material_requests created today
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .gte('created_at', '2026-10-01T10:00:00')
    .order('created_at', { ascending: false });

  console.log(`\nFound ${reqs?.length || 0} material requests created today:`);
  reqs?.forEach(r => console.log(`  Req ID: ${r.id} | TaskId: ${r.task_id} | Category: ${r.category} | Qty: ${r.quantity} | Status: ${r.status} | Details: ${r.details}`));
}

inspectNaryad();
