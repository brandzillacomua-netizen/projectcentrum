import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

// Function to normalize sheet name / thickness
function getSheetKey(name) {
  const clean = (name || '').toLowerCase();
  const mType = clean.includes('т700') || clean.includes('t700') ? 'T700' : (clean.includes('т300') || clean.includes('t300') ? 'T300' : 'Other');
  const mThick = clean.match(/(\d+(?:\.\d+)?)\s*мм/);
  const thick = mThick ? mThick[1] : '0';
  return `${mType}_${thick}mm`;
}

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Fetch inventory sheets
  const { data: sheets } = await supabase
    .from('inventory')
    .select('*')
    .or('name.ilike.%лист%,name.ilike.%sheet%')
    .order('name');

  // 2. Fetch nomenclatures
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const nomMap = new Map((noms || []).map(n => [n.id, n]));

  // 3. Fetch all active orders
  const { data: orders } = await supabase.from('orders').select('*');
  const orderMap = new Map((orders || []).map(o => [o.id, o]));

  // 4. Fetch all active material requests
  const { data: activeReqs } = await supabase
    .from('material_requests')
    .select('*')
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  // 5. Fetch all tasks with step 'Розкрій' or active tasks
  const { data: tasks } = await supabase.from('tasks').select('*');
  const taskMap = new Map((tasks || []).map(t => [t.id, t]));

  // 6. Fetch work_cards for all tasks that have active sheet requests or are in-progress
  const relevantTaskIds = [
    'aeee6441-e6e4-4112-b570-5bb173107910',
    'dd8f6032-bc26-4eda-ad99-413e26515978',
    '7c9f0d04-12c9-4273-b4f8-d2430593b3f8',
    '6076b2e8-99b7-409d-8a51-b9c333ab63d7'
  ];

  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .in('task_id', relevantTaskIds);

  console.log('=== CALCULATION AUDIT PER SHEET POSITION ===\n');

  // Map each sheet to its analysis
  for (const sheet of sheets) {
    if (sheet.warehouse && sheet.warehouse !== 'operational') continue;

    const sheetKey = getSheetKey(sheet.name);
    // Find active requests for this sheet
    const matchedReqs = (activeReqs || []).filter(r =>
      r.inventory_id === sheet.id || (sheet.nomenclature_id && r.nomenclature_id === sheet.nomenclature_id)
    );

    // If no active requests and reserved_qty == 0, skip
    if (matchedReqs.length === 0 && sheet.reserved_qty === 0) continue;

    console.log(`================================================================================`);
    console.log(`SHEET: "${sheet.name}"`);
    console.log(`  ID: ${sheet.id} | Nom ID: ${sheet.nomenclature_id}`);
    console.log(`  Current Total in DB: ${sheet.total_qty}`);
    console.log(`  Current Reserved in DB: ${sheet.reserved_qty}`);
    console.log(`  Active Material Requests (${matchedReqs.length}):`);
    
    let totalReqQty = 0;
    for (const r of matchedReqs) {
      totalReqQty += Number(r.quantity) || 0;
      console.log(`    - Req ${r.id}: qty=${r.quantity}, status=${r.status}, task_id=${r.task_id}, details=${r.details}`);
    }

    // Now analyze cards associated with these tasks
    // For each task, how many sheets were cut vs remaining?
    let totalCutSheets = 0;
    let totalRemainingSheets = 0;

    for (const r of matchedReqs) {
      const taskCards = (cards || []).filter(c => c.task_id === r.task_id);
      
      // Filter cards that match this sheet's material / thickness
      // How to match? Check card nomenclature or order material or card_info
      const matchingCards = taskCards.filter(c => {
        const nom = nomMap.get(c.nomenclature_id);
        const nomName = nom?.name || '';
        // If request details mention this nomenclature or thickness:
        const sheetThickMatch = sheet.name.match(/(\d+(?:\.\d+)?)\s*мм/);
        const sheetThick = sheetThickMatch ? sheetThickMatch[1] : '';
        const nomThickMatch = nomName.match(/-(\d+(?:\.\d+)?)-\d+$/);
        const nomThick = nomThickMatch ? nomThickMatch[1] : '';

        // If sheet is T700 and nom contains 3mm, etc.
        const reqDetails = r.details || '';
        if (reqDetails.includes(nomName) && nomName.length > 3) return true;
        if (sheetThick && nomThick && sheetThick === nomThick) return true;
        return false;
      });

      console.log(`    -> Task ${r.task_id}: found ${matchingCards.length} matching cards`);
      
      let taskCutSheets = 0;
      let taskPendingSheets = 0;
      let cutCardsCount = 0;
      let pendingCardsCount = 0;

      for (const c of matchingCards) {
        const isCut = ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status) ||
          ['сортування', 'доопрацювання', 'пакування', 'склад сгп'].some(op => (c.operation || '').toLowerCase().includes(op));

        const mSheets = (c.card_info || '').match(/\[SHEETS:(\d+)\]/);
        // If explicit sheets tag is missing, calculate from quantity & units_per_sheet
        let sCount = mSheets ? parseInt(mSheets[1], 10) : 0;
        if (sCount === 0) {
          const nom = nomMap.get(c.nomenclature_id);
          const ups = Number(nom?.units_per_sheet) || 1;
          sCount = Math.ceil((Number(c.quantity) || 0) / Math.max(1, ups));
        }

        if (isCut) {
          cutCardsCount++;
          taskCutSheets += sCount;
        } else {
          pendingCardsCount++;
          taskPendingSheets += sCount;
        }
      }

      console.log(`       Cards: ${cutCardsCount} cut (${taskCutSheets} sheets), ${pendingCardsCount} pending (${taskPendingSheets} sheets)`);
      totalCutSheets += taskCutSheets;
      totalRemainingSheets += taskPendingSheets;
    }

    console.log(`  => SUMMARY FOR "${sheet.name}":`);
    console.log(`     Total cut sheets (to deduct from total_qty): ${totalCutSheets}`);
    console.log(`     Total remaining sheets needed (true reserve): ${totalRemainingSheets}`);
    console.log(`     Current reserved_qty in DB: ${sheet.reserved_qty}`);
    console.log(`     PROPOSED NEW TOTAL: ${Math.max(0, sheet.total_qty - totalCutSheets)}`);
    console.log(`     PROPOSED NEW RESERVE: ${totalRemainingSheets}`);
  }
}

run().catch(console.error);
