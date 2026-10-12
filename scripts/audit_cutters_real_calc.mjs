import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Fetch the tasks
  const taskIds = [
    'aeee6441-e6e4-4112-b570-5bb173107910',
    'dd8f6032-bc26-4eda-ad99-413e26515978',
    '7c9f0d04-12c9-4273-b4f8-d2430593b3f8'
  ];

  // 2. Fetch cards for each task
  const { data: cards } = await supabase.from('work_cards').select('*').in('task_id', taskIds);

  // 3. Fetch material requests for cutters for these tasks
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('*')
    .in('task_id', taskIds)
    .in('status', ['issued', 'pending', 'reserved', 'approved'])
    .ilike('details', '%фреза%');

  console.log(`=== CUTTER REQUESTS BREAKDOWN BY TASK AND POSITION ===`);

  const cutterTypes = [
    { name: 'Фреза кукурудза 2х3,175х10,5х38', short: '2х3,175', match: r => r.details.includes('2х3,175') || r.details.includes('ф2') },
    { name: 'Фреза кукурудза 3х3,175х12х38', short: '3х3,175', match: r => r.details.includes('3х3,175') || r.details.includes('ф3') },
    { name: 'Фреза кукурудза 4х4х12х38', short: '4х4', match: r => r.details.includes('4х4') || r.details.includes('ф4') },
    { name: 'Фреза фасочна 6х50х90°', short: 'фасочна 6х50', match: r => r.details.includes('фасочна') || r.details.includes('ф6') }
  ];

  for (const ct of cutterTypes) {
    console.log(`\n========================================================================`);
    console.log(`ПОЗИЦІЯ: ${ct.name}`);
    
    let totalCurrentlyReserved = 0;
    let totalRealReserveRemaining = 0;
    let totalActualUsedOnCutCards = 0;

    for (const tid of taskIds) {
      const taskCards = (cards || []).filter(c => c.task_id === tid);
      const taskReqs = (reqs || []).filter(r => r.task_id === tid && ct.match(r));
      const reqSum = taskReqs.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);
      totalCurrentlyReserved += reqSum;

      // Cards stats
      const cutCards = taskCards.filter(c => ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status) || ['сортування', 'доопрацювання'].some(op => (c.operation || '').toLowerCase().includes(op)));
      const pendingCards = taskCards.filter(c => !cutCards.includes(c));

      // Actual entered cutters on cut cards
      let actualEntered = 0;
      for (const c of cutCards) {
        const m = (c.card_info || '').match(/\[CUTTERS_BREAKDOWN:(\{.*?\})\]/);
        if (m) {
          try {
            const bd = JSON.parse(m[1]);
            for (const [k, v] of Object.entries(bd)) {
              if (k.toLowerCase().includes(ct.short.toLowerCase()) || (ct.short === 'фасочна 6х50' && k.includes('фасочна'))) {
                actualEntered += Number(v) || 0;
              }
            }
          } catch (e) {}
        }
      }
      totalActualUsedOnCutCards += actualEntered;

      // Real reserve needed for pending cards
      let realReserveForTask = 0;
      if (taskCards.length > 0 && reqSum > 0) {
        if (pendingCards.length === 0) {
          realReserveForTask = 0; // Task is 100% cut
        } else {
          // Proportional to remaining cards
          realReserveForTask = Math.round(reqSum * (pendingCards.length / taskCards.length));
        }
      }
      totalRealReserveRemaining += realReserveForTask;

      console.log(`  Task ${tid.slice(0, 8)}:`);
      console.log(`    Видано в резерв: ${reqSum} шт`);
      console.log(`    Картки: ${cutCards.length} порізано, ${pendingCards.length} очікують (всього: ${taskCards.length})`);
      console.log(`    Фактично введено операторами на порізаних картках: ${actualEntered} шт`);
      console.log(`    Справжній залишок резерву під непорізані картки: ${realReserveForTask} шт`);
    }

    console.log(`\n  ПІДСУМОК ДЛЯ "${ct.name}":`);
    console.log(`  - Зараз світиться в резерві: ${totalCurrentlyReserved} шт`);
    console.log(`  - Фактично витрачено на готових картках: ${totalActualUsedOnCutCards} шт`);
    console.log(`  - Справжній резерв на картки, що залишились: ${totalRealReserveRemaining} шт`);
    console.log(`  - Завислий резерв (який треба зняти): ${totalCurrentlyReserved - totalRealReserveRemaining} шт`);
  }
}

run().catch(console.error);
