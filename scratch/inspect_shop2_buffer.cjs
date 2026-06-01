const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const headers = {
  'apikey': key,
  'Authorization': `Bearer ${key}`,
  'Content-Type': 'application/json'
};

async function run() {
  // 1. Fetch inventory items of type semi_shop2, bz_shop2
  console.log('--- INVENTORY ITEMS ---');
  const invRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/inventory?type=in.("semi_shop2","bz_shop2")', { headers });
  const inventory = await invRes.json();
  console.log(JSON.stringify(inventory, null, 2));

  // 2. Fetch work cards that might be in Shop 2 buffer or related
  console.log('\n--- WORK CARDS IN BUFFER / IN PROGRESS ---');
  const cardsRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/work_cards?status=in.("at-shop2-buffer","in-progress","completed")&limit=100', { headers });
  const cards = await cardsRes.json();
  const shop2Cards = cards.filter(c => c.operation === 'Пресування' || c.operation === 'Галтовка' || c.status === 'at-shop2-buffer' || c.task_id === '81e570a6-92f6-4f1d-a030-d005d2460005');
  console.log(shop2Cards.map(c => ({
    id: c.id,
    nomenclature_id: c.nomenclature_id,
    quantity: c.quantity,
    used_in_shop2_qty: c.used_in_shop2_qty,
    status: c.status,
    operation: c.operation,
    card_info: c.card_info,
    task_id: c.task_id,
    completed_at: c.completed_at
  })));

  // 3. Fetch task details
  console.log('\n--- TASKS FOR ORDER ---');
  const tasksRes = await fetch('https://hurzutjytlcvtbvihnry.supabase.co/rest/v1/tasks?limit=50', { headers });
  const tasks = await tasksRes.json();
  console.log(tasks.filter(t => t.id === '81e570a6-92f6-4f1d-a030-d005d2460005' || t.order_id === 'e48a12fa-a3bd-477d-944a-e455ad7d722d' || t.status !== 'completed').map(t => ({
    id: t.id,
    name: t.name,
    status: t.status,
    order_id: t.order_id,
    batch_index: t.batch_index
  })));
}

run().catch(console.error);
