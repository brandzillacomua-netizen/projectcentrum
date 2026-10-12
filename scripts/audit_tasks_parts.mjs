import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Fetch nomenclatures for cards to know sheet thickness/material
  const { data: noms } = await supabase.from('nomenclatures').select('id, name');
  const nomMap = new Map((noms || []).map(n => [n.id, n.name]));

  // 2. Inspect Task dd8f6032 (Order 711a6fba)
  console.log('=== INSPECTING TASK dd8f6032 (Order 711a6fba) ===');
  const { data: cards1 } = await supabase.from('work_cards').select('*').eq('task_id', 'dd8f6032-bc26-4eda-ad99-413e26515978');
  
  // Group by nomenclature / thickness
  const groups1 = {};
  for (const c of cards1 || []) {
    const nomName = nomMap.get(c.nomenclature_id) || 'Unknown';
    const isFinished = ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status);
    const mSheets = (c.card_info || '').match(/\[SHEETS:(\d+)\]/);
    const sheets = mSheets ? parseInt(mSheets[1], 10) : 0;

    groups1[nomName] = groups1[nomName] || { totalCards: 0, finishedCards: 0, pendingCards: 0, finishedSheets: 0, pendingSheets: 0, statuses: {} };
    groups1[nomName].totalCards++;
    groups1[nomName].statuses[c.status] = (groups1[nomName].statuses[c.status] || 0) + 1;
    if (isFinished) {
      groups1[nomName].finishedCards++;
      groups1[nomName].finishedSheets += sheets;
    } else {
      groups1[nomName].pendingCards++;
      groups1[nomName].pendingSheets += sheets;
    }
  }

  for (const [name, g] of Object.entries(groups1)) {
    console.log(`\nPart: ${name}`);
    console.log(`  Total cards: ${g.totalCards} (finished: ${g.finishedCards}, pending: ${g.pendingCards})`);
    console.log(`  Sheets: ${g.finishedSheets} cut / ${g.pendingSheets} remaining`);
    console.log(`  Statuses:`, g.statuses);
  }

  // 3. Inspect Task 7c9f0d04
  console.log('\n\n=== INSPECTING TASK 7c9f0d04 ===');
  const { data: cards2 } = await supabase.from('work_cards').select('*').eq('task_id', '7c9f0d04-12c9-4273-b4f8-d2430593b3f8');
  const groups2 = {};
  for (const c of cards2 || []) {
    const nomName = nomMap.get(c.nomenclature_id) || 'Unknown';
    const isFinished = ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status);
    const mSheets = (c.card_info || '').match(/\[SHEETS:(\d+)\]/);
    const sheets = mSheets ? parseInt(mSheets[1], 10) : 0;
    groups2[nomName] = groups2[nomName] || { totalCards: 0, finishedCards: 0, pendingCards: 0, finishedSheets: 0, pendingSheets: 0, statuses: {} };
    groups2[nomName].totalCards++;
    groups2[nomName].statuses[c.status] = (groups2[nomName].statuses[c.status] || 0) + 1;
    if (isFinished) {
      groups2[nomName].finishedCards++;
      groups2[nomName].finishedSheets += sheets;
    } else {
      groups2[nomName].pendingCards++;
      groups2[nomName].pendingSheets += sheets;
    }
  }
  for (const [name, g] of Object.entries(groups2)) {
    console.log(`\nPart: ${name}`);
    console.log(`  Total cards: ${g.totalCards} (finished: ${g.finishedCards}, pending: ${g.pendingCards})`);
    console.log(`  Sheets: ${g.finishedSheets} cut / ${g.pendingSheets} remaining`);
    console.log(`  Statuses:`, g.statuses);
  }

  // 4. Inspect Task 6076b2e8
  console.log('\n\n=== INSPECTING TASK 6076b2e8 ===');
  const { data: cards3 } = await supabase.from('work_cards').select('*').eq('task_id', '6076b2e8-99b7-409d-8a51-b9c333ab63d7');
  console.log('Cards count for 6076b2e8:', cards3?.length);
  for (const c of cards3 || []) {
    console.log({ id: c.id, nom: nomMap.get(c.nomenclature_id), status: c.status, op: c.operation, info: c.card_info });
  }
}

run().catch(console.error);
