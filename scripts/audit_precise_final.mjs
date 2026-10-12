import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Operational sheet inventory
  const { data: sheets } = await supabase
    .from('inventory')
    .select('*')
    .or('name.ilike.%лист%,name.ilike.%sheet%')
    .order('name');

  const opSheets = sheets.filter(s => !s.warehouse || s.warehouse === 'operational');

  // 2. Nomenclatures
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const nomMap = new Map((noms || []).map(n => [n.id, n]));

  // 3. Active requests
  const { data: activeReqs } = await supabase
    .from('material_requests')
    .select('*')
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  // 4. Tasks
  const taskIds = Array.from(new Set(activeReqs.map(r => r.task_id).filter(Boolean)));
  const { data: tasks } = await supabase.from('tasks').select('*').in('id', taskIds);
  const taskMap = new Map(tasks.map(t => [t.id, t]));

  // 5. Work cards for these tasks
  const { data: allCards } = await supabase.from('work_cards').select('*').in('task_id', taskIds);

  console.log('=== PRECISE AUDIT OF ACTIVE MATERIAL REQUESTS & SHEET USAGE ===\n');

  const auditReport = [];

  for (const sheet of opSheets) {
    // Matched requests
    const sheetReqs = activeReqs.filter(r =>
      r.inventory_id === sheet.id || (sheet.nomenclature_id && r.nomenclature_id === sheet.nomenclature_id)
    );

    if (sheetReqs.length === 0 && sheet.reserved_qty === 0) continue;

    const sheetThickMatch = sheet.name.match(/(\d+(?:\.\d+)?)\s*мм/);
    const sheetThick = sheetThickMatch ? sheetThickMatch[1] : '';
    const isT700 = sheet.name.toLowerCase().includes('т700') || sheet.name.toLowerCase().includes('t700');
    const isT300 = sheet.name.toLowerCase().includes('т300') || sheet.name.toLowerCase().includes('t300');

    // Group requests by task
    const reqsByTask = {};
    for (const r of sheetReqs) {
      reqsByTask[r.task_id] = reqsByTask[r.task_id] || [];
      reqsByTask[r.task_id].push(r);
    }

    let cutSheetsForThisItem = 0;
    let pendingSheetsForThisItem = 0;
    const taskDetails = [];

    for (const [taskId, reqs] of Object.entries(reqsByTask)) {
      const task = taskMap.get(taskId);
      const taskCards = (allCards || []).filter(c => c.task_id === taskId);
      const totalReqQty = reqs.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      // Filter cards belonging to this sheet's material & thickness
      const matchedCards = taskCards.filter(c => {
        const nom = nomMap.get(c.nomenclature_id);
        const nomName = nom?.name || '';
        const mThick = nomName.match(/-(\d+(?:\.\d+)?)-\d+$/);
        const nomThick = mThick ? mThick[1] : '';

        // Check if any request details mention this part
        const matchesDetails = reqs.some(r => (r.details || '').includes(nomName) && nomName.length > 3);
        if (matchesDetails) return true;
        if (sheetThick && nomThick && sheetThick === nomThick) {
          // If task is known to be T700 or T300:
          const taskTitle = task?.title || '';
          if (isT700 && (taskTitle.includes('Т700') || reqs.some(r => r.details?.includes('Т700')))) return true;
          if (isT300 && (taskTitle.includes('Т300') || reqs.some(r => r.details?.includes('Т300')))) return true;
          return true;
        }
        return false;
      });

      // Calculate how many cards cut vs pending
      let cutCards = 0;
      let pendingCards = 0;
      let cutSheets = 0;
      let pendingSheets = 0;

      for (const c of matchedCards) {
        const isCut = ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status) ||
          ['сортування', 'доопрацювання', 'пакування', 'склад сгп'].some(op => (c.operation || '').toLowerCase().includes(op));

        const mSheets = (c.card_info || '').match(/\[SHEETS:(\d+)\]/);
        let s = mSheets ? parseInt(mSheets[1], 10) : 0;
        if (s === 0) {
          const nom = nomMap.get(c.nomenclature_id);
          const ups = Number(nom?.units_per_sheet) || 1;
          s = Math.ceil((Number(c.quantity) || 0) / Math.max(1, ups));
        }

        if (isCut) {
          cutCards++;
          cutSheets += s;
        } else {
          pendingCards++;
          pendingSheets += s;
        }
      }

      // Proportional or capped calculation:
      // If all matched cards are cut (pendingCards === 0), then 100% of the requested sheets for this task are cut!
      let actualCutSheets = 0;
      let actualPendingSheets = 0;

      if (matchedCards.length > 0) {
        if (pendingCards === 0) {
          // 100% cut
          actualCutSheets = totalReqQty;
          actualPendingSheets = 0;
        } else if (cutCards === 0) {
          // 0% cut
          actualCutSheets = 0;
          actualPendingSheets = totalReqQty;
        } else {
          // Partially cut: proportion of cut cards
          const ratio = cutCards / matchedCards.length;
          actualCutSheets = Math.round(totalReqQty * ratio);
          actualPendingSheets = totalReqQty - actualCutSheets;
        }
      } else {
        // No cards found (e.g. SGP-only or cancelled)
        if (task?.status === 'completed' || task?.step !== 'Розкрій') {
          actualCutSheets = 0;
          actualPendingSheets = 0; // Orphan request should be cancelled
        } else {
          actualPendingSheets = totalReqQty;
        }
      }

      cutSheetsForThisItem += actualCutSheets;
      pendingSheetsForThisItem += actualPendingSheets;

      taskDetails.push({
        taskId,
        taskStep: task?.step,
        taskStatus: task?.status,
        reqIds: reqs.map(r => r.id),
        totalReqQty,
        matchedCardsCount: matchedCards.length,
        cutCards,
        pendingCards,
        actualCutSheets,
        actualPendingSheets
      });
    }

    const currentTotal = Number(sheet.total_qty) || 0;
    const currentReserved = Number(sheet.reserved_qty) || 0;
    const newTotal = Math.max(0, currentTotal - cutSheetsForThisItem);
    const newReserved = pendingSheetsForThisItem;

    auditReport.push({
      id: sheet.id,
      name: sheet.name,
      currentTotal,
      cutSheets: cutSheetsForThisItem,
      newTotal,
      currentReserved,
      pendingSheets: pendingSheetsForThisItem,
      newReserved,
      taskDetails
    });
  }

  console.log('SUMMARY TABLE:');
  console.table(auditReport.map(r => ({
    "Лист": r.name,
    "Зараз на складі (total)": r.currentTotal,
    "Фактично вирізано (списати)": r.cutSheets,
    "Новий залишок на складі": r.newTotal,
    "Зараз в резерві": r.currentReserved,
    "Дійсно в роботі (новий резерв)": r.newReserved,
    "Різниця резерву (зняти)": r.currentReserved - r.newReserved
  })));

  console.log('\nDETAILED BREAKDOWN BY POSITION:');
  for (const r of auditReport) {
    console.log(`\n======================================================`);
    console.log(`Позиція: ${r.name}`);
    console.log(`Поточний склад: ${r.currentTotal} | Поточний резерв: ${r.currentReserved}`);
    console.log(`Вирізано листів: ${r.cutSheets} -> Новий склад: ${r.newTotal}`);
    console.log(`Залишилось дорізати: ${r.newReserved} -> Новий резерв: ${r.newReserved}`);
    for (const td of r.taskDetails) {
      console.log(`  * Task ${td.taskId} [step: ${td.taskStep}, status: ${td.taskStatus}]:`);
      console.log(`    Запитів: ${td.totalReqQty} шт. Карток: ${td.matchedCardsCount} (вирізано: ${td.cutCards}, очікують: ${td.pendingCards}).`);
      console.log(`    -> Списати зі складу: ${td.actualCutSheets} л., Залишити в резерві: ${td.actualPendingSheets} л.`);
    }
  }
}

run().catch(console.error);
