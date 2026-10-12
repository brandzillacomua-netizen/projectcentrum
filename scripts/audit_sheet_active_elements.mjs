import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Get sheets
  const { data: sheets } = await supabase.from('inventory').select('*').or('name.ilike.%лист%,name.ilike.%sheet%').order('name');
  const sheetIds = new Set(sheets.map(s => s.id));
  const sheetNomIds = new Set(sheets.map(s => s.nomenclature_id).filter(Boolean));

  // 2. Get all active material requests
  const { data: allActiveReqs } = await supabase
    .from('material_requests')
    .select('*')
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  const sheetActiveReqs = (allActiveReqs || []).filter(r =>
    sheetIds.has(r.inventory_id) || (r.nomenclature_id && sheetNomIds.has(r.nomenclature_id))
  );

  console.log(`Total active requests in DB: ${allActiveReqs?.length}`);
  console.log(`Active requests for sheets: ${sheetActiveReqs.length}\n`);

  for (const r of sheetActiveReqs) {
    const s = sheets.find(sh => sh.id === r.inventory_id || sh.nomenclature_id === r.nomenclature_id);
    console.log({
      id: r.id,
      sheet_name: s?.name,
      qty: r.quantity,
      status: r.status,
      task_id: r.task_id,
      card_id: r.card_id,
      order_id: r.order_id,
      created_at: r.created_at,
      details: r.details
    });
  }

  // 3. Check active tasks
  const { data: allTasks } = await supabase
    .from('tasks')
    .select('id, naryad_number, step, status, warehouse_conf, plan_snapshot, created_at');

  const activeTasks = (allTasks || []).filter(t => !['completed', 'cancelled'].includes(t.status));
  console.log(`\nTotal tasks: ${allTasks?.length}, Active tasks: ${activeTasks.length}`);
  for (const t of activeTasks) {
    console.log(`Task #${t.naryad_number} (id: ${t.id}): step=${t.step}, status=${t.status}, wh_conf=${t.warehouse_conf}`);
  }

  // 4. Check active BZ reservations for sheets
  const { data: bzRes } = await supabase
    .from('bz_inventory_reservations')
    .select('*')
    .eq('status', 'allocated');
  const sheetBz = (bzRes || []).filter(b => sheetNomIds.has(b.nomenclature_id));
  console.log(`\nActive BZ reservations for sheets: ${sheetBz.length}`);
  for (const b of sheetBz) {
    console.log(b);
  }
}

run().catch(console.error);
