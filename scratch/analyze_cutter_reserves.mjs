import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  // 1. All cutter inventory on operational warehouse
  const { data: invList } = await supabase
    .from('inventory')
    .select('id, name, nomenclature_id, total_qty, reserved_qty, warehouse')
    .or('warehouse.eq.operational,warehouse.is.null')
    .ilike('name', '%фреза%');

  console.log('--- OPERATIONAL CUTTER INVENTORY ITEMS ---');
  let totalInvReserved = 0;
  for (const item of (invList || [])) {
    const res = Number(item.reserved_qty) || 0;
    totalInvReserved += res;
    if (res > 0) {
      console.log(`[${item.name}] total: ${item.total_qty}, reserved: ${item.reserved_qty}`);
    }
  }
  console.log(`Total reserved on operational inventory: ${totalInvReserved}`);

  // 2. Fetch all open cutter requests (issued, pending)
  const { data: allReqs } = await supabase
    .from('material_requests')
    .select('id, task_id, card_id, nomenclature_id, inventory_id, details, quantity, status')
    .in('status', ['issued', 'pending'])
    .ilike('details', '%фреза%');

  console.log(`Found ${allReqs?.length} open cutter requests in material_requests.`);

  // Group by task_id
  const taskIds = [...new Set(allReqs.map(r => r.task_id).filter(Boolean))];
  console.log(`Referencing ${taskIds.length} tasks.`);

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status')
    .in('id', taskIds);

  const taskMap = new Map((tasks || []).map(t => [String(t.id), t.status]));

  // Also fetch work_cards for these tasks to check if cards are all completed / at-buffer
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, status, operation')
    .in('task_id', taskIds);

  const cardsByTask = new Map();
  for (const c of (cards || [])) {
    const tId = String(c.task_id);
    if (!cardsByTask.has(tId)) cardsByTask.set(tId, []);
    cardsByTask.get(tId).push(c);
  }

  let phantomReqsCount = 0;
  let phantomQty = 0;
  let activeReqsCount = 0;
  let activeQty = 0;

  for (const req of (allReqs || [])) {
    const tId = String(req.task_id);
    const tStatus = taskMap.get(tId);
    const taskCards = cardsByTask.get(tId) || [];
    
    // A cutting card request is considered phantom if:
    // 1) Task is terminal ('completed', 'cancelled', 'archived'), OR
    // 2) Task has no cutting cards in 'in-progress' or 'new', and all cutting cards are past cutting ('at-buffer', 'at-shop2-buffer', 'completed', 'scrap', 'archived')
    // 3) Or specific card_id is already completed / at-buffer
    const isTerminalTask = ['completed', 'cancelled', 'archived'].includes(tStatus);
    const activeCuttingCards = taskCards.filter(c => 
      c.operation === 'Розкрій' && ['new', 'in-progress'].includes(c.status)
    );

    const isPhantom = isTerminalTask || (taskCards.length > 0 && activeCuttingCards.length === 0);

    const q = Number(req.quantity) || 0;
    if (isPhantom) {
      phantomReqsCount++;
      phantomQty += q;
    } else {
      activeReqsCount++;
      activeQty += q;
    }
  }

  console.log(`Phantom cutter requests: ${phantomReqsCount} requests, total quantity: ${phantomQty}`);
  console.log(`Active cutter requests: ${activeReqsCount} requests, total quantity: ${activeQty}`);
}

main();
