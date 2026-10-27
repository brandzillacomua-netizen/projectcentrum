import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  console.log('=== 1. FETCHING CUTTER INVENTORY ON OPERATIONAL WAREHOUSE ===');
  const { data: invList } = await supabase
    .from('inventory')
    .select('id, name, nomenclature_id, total_qty, reserved_qty, warehouse')
    .or('warehouse.eq.operational,warehouse.is.null')
    .ilike('name', '%фреза%');

  console.log('Current operational cutter inventory:');
  for (const inv of invList || []) {
    console.log(`- [${inv.name}] total: ${inv.total_qty}, reserved: ${inv.reserved_qty}`);
  }

  console.log('\n=== 2. FETCHING ALL OPEN CUTTER REQUESTS ===');
  // Fetch in batches if necessary
  let allReqs = [];
  let from = 0;
  const batchSize = 1000;
  while (true) {
    const { data: chunk, error } = await supabase
      .from('material_requests')
      .select('id, task_id, card_id, nomenclature_id, inventory_id, details, quantity, status')
      .in('status', ['issued', 'pending', 'reserved', 'approved'])
      .ilike('details', '%фреза%')
      .range(from, from + batchSize - 1);
    if (error) throw error;
    if (!chunk || chunk.length === 0) break;
    allReqs = allReqs.concat(chunk);
    if (chunk.length < batchSize) break;
    from += batchSize;
  }
  console.log(`Total open cutter requests fetched: ${allReqs.length}`);

  // Gather referenced task_ids and card_ids
  const taskIds = [...new Set(allReqs.map(r => r.task_id).filter(Boolean))];
  const cardIds = [...new Set(allReqs.map(r => r.card_id).filter(Boolean))];

  console.log(`Referenced task IDs: ${taskIds.length}, card IDs: ${cardIds.length}`);

  const { data: tasks } = await supabase.from('tasks').select('id, status').in('id', taskIds);
  const taskMap = new Map((tasks || []).map(t => [String(t.id), t.status]));

  // Fetch cards
  const { data: cards } = await supabase.from('work_cards').select('id, task_id, status, operation').in('task_id', taskIds);
  const cardMap = new Map((cards || []).map(c => [String(c.id), c]));

  const cardsByTask = new Map();
  for (const c of cards || []) {
    const tId = String(c.task_id);
    if (!cardsByTask.has(tId)) cardsByTask.set(tId, []);
    cardsByTask.get(tId).push(c);
  }

  const phantomReqIds = [];
  let phantomQty = 0;
  const activeReqs = [];

  for (const req of allReqs) {
    const tId = req.task_id ? String(req.task_id) : null;
    const cId = req.card_id ? String(req.card_id) : null;

    const tStatus = tId ? taskMap.get(tId) : null;
    const reqCard = cId ? cardMap.get(cId) : null;
    const taskCards = tId ? (cardsByTask.get(tId) || []) : [];

    let isPhantom = false;

    // 1. If explicit card_id is already finished in cutting
    if (reqCard) {
      if (
        ['completed', 'scrap', 'archived', 'at-buffer', 'at-shop2-buffer'].includes(reqCard.status) ||
        reqCard.operation !== 'Розкрій'
      ) {
        isPhantom = true;
      }
    }

    // 2. If task is terminal
    if (tStatus && ['completed', 'cancelled', 'archived'].includes(tStatus)) {
      isPhantom = true;
    }

    // 3. If task has no active cutting cards
    if (taskCards.length > 0) {
      const activeCuttingCards = taskCards.filter(c =>
        c.operation === 'Розкрій' && ['new', 'in-progress'].includes(c.status)
      );
      if (activeCuttingCards.length === 0) {
        isPhantom = true;
      }
    }

    // 4. If card details indicate card is done
    if (!isPhantom && req.details) {
      const m = req.details.match(/Картка №(\d+)\/(\d+)/);
      if (m && tId) {
        const cardNumStr = `№${m[1]}/${m[2]}`;
        const foundCard = taskCards.find(c => (c.card_info || '').includes(cardNumStr));
        if (foundCard && (
          ['completed', 'scrap', 'archived', 'at-buffer', 'at-shop2-buffer'].includes(foundCard.status) ||
          foundCard.operation !== 'Розкрій'
        )) {
          isPhantom = true;
        }
      }
    }

    if (isPhantom) {
      phantomReqIds.push(req.id);
      phantomQty += Number(req.quantity) || 0;
    } else {
      activeReqs.push(req);
    }
  }

  console.log(`\n=== 3. ANALYSIS RESULTS ===`);
  console.log(`Identified ${phantomReqIds.length} PHANTOM requests to close (total qty: ${phantomQty} cutters)`);
  console.log(`Identified ${activeReqs.length} GENUINELY ACTIVE cutter requests remaining (total qty: ${activeReqs.reduce((s, r) => s + (Number(r.quantity) || 0), 0)} cutters)`);

  console.log('\n=== 4. CLOSING PHANTOM MATERIAL REQUESTS IN SUPABASE ===');
  const updateChunkSize = 100;
  let updatedCount = 0;
  for (let i = 0; i < phantomReqIds.length; i += updateChunkSize) {
    const chunk = phantomReqIds.slice(i, i + updateChunkSize);
    const { error: updErr } = await supabase
      .from('material_requests')
      .update({ status: 'completed', quantity: 0 })
      .in('id', chunk);
    if (updErr) {
      console.error('Error updating requests chunk:', updErr);
      throw updErr;
    }
    updatedCount += chunk.length;
    process.stdout.write(`Updated ${updatedCount}/${phantomReqIds.length} requests...\r`);
  }
  console.log(`\nSuccessfully marked ${updatedCount} phantom cutter requests as completed!`);

  console.log('\n=== 5. RECONCILING INVENTORY.RESERVED_QTY ON OPERATIONAL WAREHOUSE ===');
  for (const inv of invList || []) {
    const invId = inv.id;
    const invNomId = inv.nomenclature_id;
    const invName = (inv.name || '').toLowerCase();

    // Sum active requests that match this inventory item
    const matchingActive = activeReqs.filter(r => {
      if (r.inventory_id && String(r.inventory_id) === String(invId)) return true;
      if (invNomId && r.nomenclature_id && String(r.nomenclature_id) === String(invNomId)) return true;
      if (invName.includes('2х') && (r.details || '').toLowerCase().includes('ф2')) return true;
      if (invName.includes('3х') && (r.details || '').toLowerCase().includes('ф3')) return true;
      if (invName.includes('6х') && (r.details || '').toLowerCase().includes('ф6')) return true;
      return false;
    });

    const newReservedQty = matchingActive.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
    console.log(`- [${inv.name}]: old reserved = ${inv.reserved_qty} -> NEW RECONCILED RESERVED = ${newReservedQty} (active requests: ${matchingActive.length})`);

    const { error: invErr } = await supabase
      .from('inventory')
      .update({ reserved_qty: newReservedQty })
      .eq('id', inv.id);

    if (invErr) {
      console.error(`Error updating inventory ${inv.id}:`, invErr);
    }
  }

  console.log('\n=== CLEANUP COMPLETED SUCCESSFULLY! ===');
}

main().catch(err => {
  console.error('Cleanup script failed:', err);
  process.exit(1);
});
