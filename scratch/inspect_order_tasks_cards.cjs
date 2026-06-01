const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  // 1. Find the order with order_num like 29052026-07
  const orderRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/orders?order_num=ilike.*29052026-07*', { headers });
  const orders = await orderRes.json();
  if (orders.length === 0) {
    console.log('Order not found');
    return;
  }
  const order = orders[0];
  console.log('Order:', { id: order.id, order_num: order.order_num, status: order.status });

  // 2. Fetch all tasks for this order
  const tasksRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?order_id=eq.${order.id}`, { headers });
  const tasks = await tasksRes.json();
  console.log('\nTasks for order:');
  console.table(tasks.map(t => ({
    id: t.id,
    name: t.name,
    batch_index: t.batch_index,
    status: t.status,
    completed_at: t.completed_at
  })));

  // 3. Fetch all work cards for this order
  const cardsRes = await fetch(`https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?order_id=eq.${order.id}`, { headers });
  const cards = await cardsRes.json();
  console.log('\nWork cards for order:');
  console.table(cards.map(c => ({
    id: c.id,
    task_id: c.task_id,
    nomenclature_id: c.nomenclature_id,
    quantity: c.quantity,
    used_in_shop2_qty: c.used_in_shop2_qty,
    status: c.status,
    operation: c.operation,
    card_info: c.card_info,
    completed_at: c.completed_at
  })));
}

run().catch(console.error);
