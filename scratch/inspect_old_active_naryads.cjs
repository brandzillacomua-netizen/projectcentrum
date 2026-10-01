const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function inspectOldActive() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  console.log('=== INSPECTING ACTIVE ORDERS CREATED BEFORE 2026-10-01 ===');
  const { data: oldOrders } = await supabase
    .from('orders')
    .select('id, order_num, status, created_at')
    .lt('created_at', '2026-10-01T00:00:00')
    .not('status', 'in', '("completed","shipped","cancelled")');

  console.log(`Active old orders count: ${oldOrders?.length || 0}`);
  oldOrders?.forEach(o => console.log(`  Order: ${o.order_num} | ID: ${o.id} | Status: ${o.status} | Created: ${o.created_at}`));

  console.log('\n=== INSPECTING ACTIVE TASKS CREATED BEFORE 2026-10-01 ===');
  const { data: oldTasks } = await supabase
    .from('tasks')
    .select('id, order_id, step, status, created_at')
    .lt('created_at', '2026-10-01T00:00:00')
    .not('status', 'in', '("completed","cancelled")');

  console.log(`Active old tasks count: ${oldTasks?.length || 0}`);
  oldTasks?.forEach(t => console.log(`  Task ID: ${t.id} | Step: ${t.step} | Status: ${t.status} | OrderID: ${t.order_id} | Created: ${t.created_at}`));

  console.log('\n=== INSPECTING ACTIVE WORK CARDS CREATED BEFORE 2026-10-01 ===');
  const { data: oldCards } = await supabase
    .from('work_cards')
    .select('id, card_number, task_id, operation, status, created_at')
    .lt('created_at', '2026-10-01T00:00:00')
    .not('status', 'in', '("completed","scrapped")');

  console.log(`Active old work cards count: ${oldCards?.length || 0}`);
  oldCards?.forEach(c => console.log(`  Card: ${c.card_number || c.id} | Op: ${c.operation} | Status: ${c.status} | TaskId: ${c.task_id} | Created: ${c.created_at}`));

  console.log('\n=== INSPECTING ACTIVE MATERIAL REQUESTS CREATED BEFORE 2026-10-01 ===');
  const { data: oldReqs } = await supabase
    .from('material_requests')
    .select('id, task_id, order_id, category, status, details, created_at')
    .lt('created_at', '2026-10-01T00:00:00')
    .not('status', 'in', '("completed","cancelled")');

  console.log(`Active old material requests count: ${oldReqs?.length || 0}`);
  oldReqs?.forEach(r => console.log(`  Req ID: ${r.id} | Status: ${r.status} | Details: ${r.details} | Created: ${r.created_at}`));
}

inspectOldActive();
