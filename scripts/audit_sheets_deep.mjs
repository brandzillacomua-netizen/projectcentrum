import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Get all sheet inventory items
  const { data: sheets } = await supabase
    .from('inventory')
    .select('*')
    .or('name.ilike.%лист%,name.ilike.%sheet%')
    .order('name');

  const sheetIds = sheets.map(s => s.id);
  const sheetNomIds = sheets.map(s => s.nomenclature_id).filter(Boolean);

  console.log('Sheet items count:', sheets.length);

  // 2. Fetch all material requests for sheets
  const { data: sheetReqs } = await supabase
    .from('material_requests')
    .select('*')
    .or(`inventory_id.in.(${sheetIds.join(',')}),nomenclature_id.in.(${sheetNomIds.join(',')})`);

  console.log(`\nMaterial requests linked to sheets: ${sheetReqs?.length}`);
  
  // Group sheet requests by status
  const reqsByStatus = {};
  sheetReqs?.forEach(r => {
    reqsByStatus[r.status] = (reqsByStatus[r.status] || 0) + 1;
  });
  console.log('Sheet requests by status:', reqsByStatus);

  // 3. For the sheets with reserved_qty > 0:
  const reservedSheets = sheets.filter(s => s.reserved_qty > 0);
  console.log('\n=== SHEETS WITH RESERVED_QTY > 0 ===');
  for (const s of reservedSheets) {
    console.log(`\n--------------------------------------------------`);
    console.log(`SHEET: ${s.name} (id: ${s.id}, nom_id: ${s.nomenclature_id})`);
    console.log(`Total stock in DB: ${s.total_qty}, Reserved in DB: ${s.reserved_qty}`);

    const reqs = sheetReqs?.filter(r => r.inventory_id === s.id || r.nomenclature_id === s.nomenclature_id) || [];
    console.log(`Requests count: ${reqs.length}`);
    for (const r of reqs) {
      console.log(`  Req #${r.id}: qty=${r.quantity}, status=${r.status}, task_id=${r.task_id}, card_id=${r.card_id}, order_id=${r.order_id}, created=${r.created_at}, details=${r.details}`);
    }
  }

  // 4. Fetch all cutting cards (work_cards where operation = 'Розкрій')
  const { data: cuttingCards, error: ccErr } = await supabase
    .from('work_cards')
    .select('id, task_id, order_id, operation, status, quantity, card_info, created_at, updated_at, completed_at, nomenclature_id')
    .ilike('operation', '%розкрій%')
    .order('created_at', { ascending: false })
    .limit(200);

  if (ccErr) console.error('Error fetching cutting cards:', ccErr);
  else {
    console.log(`\nFetched ${cuttingCards.length} cutting cards.`);
    const statusCounts = {};
    cuttingCards.forEach(c => statusCounts[c.status] = (statusCounts[c.status] || 0) + 1);
    console.log('Cutting cards status distribution:', statusCounts);
  }

  // 5. Check active tasks (tasks not completed)
  const { data: activeTasks } = await supabase
    .from('tasks')
    .select('id, naryad_number, step, status, warehouse_conf, plan_snapshot, created_at')
    .not('status', 'in', '("completed","cancelled")');

  console.log(`\nActive tasks count: ${activeTasks?.length}`);
  for (const t of activeTasks || []) {
    console.log(`  Task #${t.naryad_number} (id: ${t.id}): step=${t.step}, status=${t.status}, wh_conf=${t.warehouse_conf}`);
  }
}

run().catch(console.error);
