import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Operational inventory for cutters
  const { data: cutters } = await supabase
    .from('inventory')
    .select('id, name, nomenclature_id, total_qty, reserved_qty, warehouse, updated_at')
    .ilike('name', '%фреза%')
    .or('warehouse.eq.operational,warehouse.is.null')
    .order('name');

  console.log('=== CUTTERS IN OPERATIONAL INVENTORY ===');
  console.table(cutters?.filter(c => c.total_qty > 0 || c.reserved_qty > 0));

  // 2. Active material requests for cutters
  const { data: cutterReqs } = await supabase
    .from('material_requests')
    .select('*')
    .ilike('details', '%фреза%')
    .in('status', ['pending', 'approved', 'reserved', 'issued'])
    .order('created_at', { ascending: false });

  console.log(`\n=== ACTIVE CUTTER MATERIAL REQUESTS (${cutterReqs?.length || 0}) ===`);
  for (const r of cutterReqs || []) {
    console.log(`Req ${r.id}: qty=${r.quantity}, status=${r.status}, task=${r.task_id}, details=${r.details}`);
  }

  // 3. For each active task, check work cards cutters usage
  const activeTaskIds = Array.from(new Set((cutterReqs || []).map(r => r.task_id).filter(Boolean)));
  console.log(`\nActive tasks linked to cutters:`, activeTaskIds);

  for (const tid of activeTaskIds) {
    const { data: task } = await supabase.from('tasks').select('*').eq('id', tid).single();
    const { data: cards } = await supabase.from('work_cards').select('id, operation, status, cutters_used, card_info, quantity').eq('task_id', tid);
    
    console.log(`\n======================================================`);
    console.log(`Task #${task?.naryad_number || tid} (step=${task?.step}, status=${task?.status})`);
    console.log(`Cards count: ${cards?.length}`);
    
    let cutCardsCount = 0;
    let pendingCardsCount = 0;
    const actualCuttersUsed = {};

    for (const c of cards || []) {
      const isCut = ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status) ||
        ['сортування', 'доопрацювання', 'пакування', 'склад сгп'].some(op => (c.operation || '').toLowerCase().includes(op));

      if (isCut) {
        cutCardsCount++;
        // Check CUTTERS_BREAKDOWN
        const mBreakdown = (c.card_info || '').match(/\[CUTTERS_BREAKDOWN:(\{.*?\})\]/);
        if (mBreakdown) {
          try {
            const bd = JSON.parse(mBreakdown[1]);
            for (const [k, v] of Object.entries(bd)) {
              actualCuttersUsed[k] = (actualCuttersUsed[k] || 0) + Number(v);
            }
          } catch (e) {}
        }
      } else {
        pendingCardsCount++;
      }
    }

    console.log(`Cut cards: ${cutCardsCount}, Pending cards: ${pendingCardsCount}`);
    console.log(`Actual cutters entered in cut cards:`, actualCuttersUsed);
  }
}

run().catch(console.error);
