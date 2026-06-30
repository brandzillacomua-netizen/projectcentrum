const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  console.log("=== Querying orders containing 22062026 ===");
  const { data: orders, error: oErr } = await supabase.from('orders').select('*');
  if (oErr) console.error(oErr);
  const matchedOrders = (orders || []).filter(o => String(o.order_num).includes('22062026'));
  console.log(`Matched orders count: ${matchedOrders.length}`);
  for (const o of matchedOrders) {
    console.log(`Order ID: ${o.id} | Num: ${o.order_num} | Status: ${o.status}`);
  }

  const orderIds = matchedOrders.map(o => o.id);

  console.log("\n=== Querying tasks for these orders ===");
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('*');
  if (tErr) console.error(tErr);
  const matchedTasks = (tasks || []).filter(t => orderIds.includes(t.order_id) || String(t.title).includes('22062026') || String(t.id).includes('22062026'));
  console.log(`Matched tasks count: ${matchedTasks.length}`);
  for (const t of matchedTasks) {
    console.log(`Task ID: ${t.id} | Title: ${t.title} | Step: ${t.step} | Status: ${t.status}`);
  }

  const taskIds = matchedTasks.map(t => t.id);

  console.log("\n=== Querying work_cards for these tasks ===");
  const { data: cards, error: cErr } = await supabase.from('work_cards').select('*');
  if (cErr) console.error(cErr);
  const matchedCards = (cards || []).filter(c => taskIds.includes(c.task_id) || String(c.card_info).includes('22062026') || String(c.nomenclature_name).includes('22062026'));
  console.log(`Matched cards count: ${matchedCards.length}`);
  for (const c of matchedCards) {
    console.log(`Card ID: ${c.id} | Info: ${c.card_info} | Status: ${c.status} | Operation: ${c.operation} | TaskId: ${c.task_id}`);
  }

  console.log("\n=== Querying material_requests for these orders or tasks ===");
  const { data: reqs, error: rErr } = await supabase.from('material_requests').select('*');
  if (rErr) console.error(rErr);
  const matchedReqs = (reqs || []).filter(r => orderIds.includes(r.order_id) || taskIds.includes(r.task_id) || String(r.details).includes('22062026'));
  console.log(`Matched material requests count: ${matchedReqs.length}`);
  for (const r of matchedReqs) {
    console.log(`Request ID: ${r.id} | Qty: ${r.quantity} | Details: ${r.details} | TaskId: ${r.task_id} | Status: ${r.status || r.request_status}`);
  }
}

run().catch(console.error);
