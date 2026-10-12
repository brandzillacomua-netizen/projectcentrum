import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Target cutters in operational warehouse
  const { data: invItems } = await supabase
    .from('inventory')
    .select('*')
    .or('warehouse.eq.operational,warehouse.is.null')
    .in('name', [
      'Фреза кукурудза 2х3,175х10,5х38',
      'Фреза кукурудза 3х3,175х12х38',
      'Фреза кукурудза 4х4х12х38',
      'Фреза фасочна 6х50х90°'
    ]);

  // 2. All relevant tasks
  const taskIds = [
    'aeee6441-e6e4-4112-b570-5bb173107910',
    'dd8f6032-bc26-4eda-ad99-413e26515978',
    '7c9f0d04-12c9-4273-b4f8-d2430593b3f8'
  ];

  // 3. Work cards
  const { data: cards } = await supabase.from('work_cards').select('*').in('task_id', taskIds);

  // 4. Material requests
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .in('task_id', taskIds)
    .in('status', ['issued', 'pending', 'reserved', 'approved'])
    .ilike('details', '%фреза%');

  console.log('=== PRECISE CUTTER USAGE & RESERVE AUDIT ===\n');

  const cutterConfigs = [
    {
      id: '0f8982c4-7640-4d93-9681-1403a4527a4a',
      name: 'Фреза кукурудза 2х3,175х10,5х38',
      aliases: ['2х3,175', 'ф2']
    },
    {
      id: 'c448f726-f57a-400a-b62a-1c3b10a154d1',
      name: 'Фреза кукурудза 3х3,175х12х38',
      aliases: ['3х3,175', 'ф3']
    },
    {
      id: '67363b96-ffaa-4884-9a59-3745c9ffd7fd',
      name: 'Фреза кукурудза 4х4х12х38',
      aliases: ['4х4', 'ф4']
    },
    {
      id: '32d045cb-8004-4698-9fa3-00ccaa6217da',
      name: 'Фреза фасочна 6х50х90°',
      aliases: ['фасочна 6х50', 'ф6']
    }
  ];

  const fixPlan = [];

  for (const cfg of cutterConfigs) {
    const inv = invItems.find(i => i.id === cfg.id);
    if (!inv) {
      console.warn(`Inv item not found for ${cfg.name}`);
      continue;
    }

    // Requests matching this cutter
    const matchedReqs = (reqs || []).filter(r =>
      r.inventory_id === inv.id ||
      (inv.nomenclature_id && r.nomenclature_id === inv.nomenclature_id) ||
      cfg.aliases.some(a => (r.details || '').toLowerCase().includes(a.toLowerCase()))
    );

    let actualUsedTotal = 0;
    let realReserveRemainingTotal = 0;
    const reqsToComplete = [];
    const reqsToPartial = [];

    // Process per task
    for (const tid of taskIds) {
      const taskCards = (cards || []).filter(c => c.task_id === tid);
      const taskReqs = matchedReqs.filter(r => r.task_id === tid);
      const taskReqSum = taskReqs.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      const cutCards = taskCards.filter(c =>
        ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status) ||
        ['сортування', 'доопрацювання', 'пакування', 'склад сгп'].some(op => (c.operation || '').toLowerCase().includes(op))
      );
      const pendingCards = taskCards.filter(c => !cutCards.includes(c));

      // Calculate actual used from cut cards breakdown
      let taskActualUsed = 0;
      for (const c of cutCards) {
        const m = (c.card_info || '').match(/\[CUTTERS_BREAKDOWN:(\{.*?\})\]/);
        if (m) {
          try {
            const bd = JSON.parse(m[1]);
            for (const [k, v] of Object.entries(bd)) {
              if (cfg.aliases.some(a => k.toLowerCase().includes(a.toLowerCase()))) {
                taskActualUsed += Number(v) || 0;
              }
            }
          } catch (e) {}
        }
      }

      actualUsedTotal += taskActualUsed;

      // Reserve calculation
      if (pendingCards.length === 0) {
        // Task 100% cut -> all requests complete!
        taskReqs.forEach(r => reqsToComplete.push(r.id));
      } else {
        // Partial task
        const ratio = pendingCards.length / taskCards.length;
        const taskReserveRemaining = Math.round(taskReqSum * ratio);
        realReserveRemainingTotal += taskReserveRemaining;

        // If card requests are individual per card:
        // mark completed cards' requests as completed
        let remainingBudget = taskReserveRemaining;
        for (const r of taskReqs) {
          const rQty = Number(r.quantity) || 0;
          if (remainingBudget >= rQty) {
            remainingBudget -= rQty;
          } else if (remainingBudget > 0) {
            reqsToPartial.push({ id: r.id, nextQty: remainingBudget });
            remainingBudget = 0;
          } else {
            reqsToComplete.push(r.id);
          }
        }
      }
    }

    const currentTotal = Number(inv.total_qty) || 0;
    const currentReserved = Number(inv.reserved_qty) || 0;
    const newTotal = Math.max(0, currentTotal - actualUsedTotal);
    const newReserved = realReserveRemainingTotal;

    fixPlan.push({
      id: inv.id,
      name: inv.name,
      currentTotal,
      actualUsed: actualUsedTotal,
      newTotal,
      currentReserved,
      newReserved,
      reserveDiff: currentReserved - newReserved,
      reqsToCompleteCount: reqsToComplete.length,
      reqsToComplete,
      reqsToPartial
    });
  }

  console.log('SUMMARY AUDIT TABLE FOR CUTTERS:');
  console.table(fixPlan.map(p => ({
    "Фреза": p.name,
    "Зараз на складі (Total)": p.currentTotal,
    "Фактично використано (списати)": p.actualUsed,
    "Новий склад (Total)": p.newTotal,
    "Зараз у резерві": p.currentReserved,
    "Справжній залишок резерву": p.newReserved,
    "Зняти завислого резерву": p.reserveDiff
  })));

  for (const p of fixPlan) {
    console.log(`\n======================================================`);
    console.log(`${p.name}:`);
    console.log(`  Склад: ${p.currentTotal} - ${p.actualUsed} (фактичний знос) = ${p.newTotal} шт`);
    console.log(`  Резерв: ${p.currentReserved} -> ${p.newReserved} шт (зняти ${p.reserveDiff} шт)`);
    console.log(`  Заявок до закриття: ${p.reqsToCompleteCount}`);
  }
}

run().catch(console.error);
