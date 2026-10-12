import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. All sheets in inventory
  const { data: sheets } = await supabase.from('inventory').select('*').or('name.ilike.%лист%,name.ilike.%sheet%').order('name');
  
  // 2. All active sheet material requests
  const sheetIds = new Set(sheets.map(s => s.id));
  const sheetNomIds = new Set(sheets.map(s => s.nomenclature_id).filter(Boolean));

  const { data: allReqs } = await supabase
    .from('material_requests')
    .select('*')
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  const activeSheetReqs = (allReqs || []).filter(r =>
    sheetIds.has(r.inventory_id) || (r.nomenclature_id && sheetNomIds.has(r.nomenclature_id))
  );

  console.log(`=== ACTIVE SHEET REQUESTS (${activeSheetReqs.length}) ===`);
  const taskGrouped = {};
  for (const r of activeSheetReqs) {
    taskGrouped[r.task_id] = taskGrouped[r.task_id] || [];
    taskGrouped[r.task_id].push(r);
  }

  for (const [taskId, reqs] of Object.entries(taskGrouped)) {
    const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).maybeSingle();
    const { data: order } = await supabase.from('orders').select('*').eq('id', task?.order_id).maybeSingle();
    const { data: cards } = await supabase.from('work_cards').select('*').eq('task_id', taskId);

    console.log(`\n================================================================================`);
    console.log(`TASK: ${task?.title || task?.naryad_number || taskId}`);
    console.log(`Task details: step=${task?.step}, status=${task?.status}, order=${order?.order_number || task?.order_id}`);
    console.log(`Total cards: ${cards?.length}`);

    // Cards status breakdown
    const stCount = {};
    let cutFinishedCards = 0;
    let cutPendingCards = 0;
    let cutSheetsFinished = 0;
    let cutSheetsPending = 0;

    for (const c of cards || []) {
      stCount[c.status] = (stCount[c.status] || 0) + 1;
      const info = c.card_info || '';
      const mSheets = info.match(/\[SHEETS:(\d+)\]/);
      const sheetsCount = mSheets ? parseInt(mSheets[1], 10) : 0;

      // Has cutting been done for this card?
      // A card has finished cutting if it is at-buffer, at-shop2-buffer, completed, or in subsequent operations (Сортування, etc.)
      const isCutFinished = ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status) || 
        ['сортування', 'доопрацювання', 'пакування', 'склад сгп'].some(op => (c.operation || '').toLowerCase().includes(op));

      if (isCutFinished) {
        cutFinishedCards++;
        cutSheetsFinished += sheetsCount;
      } else {
        cutPendingCards++;
        cutSheetsPending += sheetsCount;
      }
    }

    console.log(`Card statuses:`, stCount);
    console.log(`Cutting progress: ${cutFinishedCards} cards cut (${cutSheetsFinished} sheets tagged), ${cutPendingCards} cards not cut yet (${cutSheetsPending} sheets tagged)`);

    console.log(`\nActive sheet requests for this task:`);
    for (const r of reqs) {
      const s = sheets.find(sh => sh.id === r.inventory_id || sh.nomenclature_id === r.nomenclature_id);
      console.log(`  - Req #${r.id}: ${s?.name} | qty: ${r.quantity} | status: ${r.status}`);
      console.log(`    details: ${r.details}`);
    }
  }
}

run().catch(console.error);
