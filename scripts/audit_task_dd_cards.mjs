import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // Check 10 cut cards from Task dd8f6032
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, nomenclature_id, status, quantity, card_info, completed_at, updated_at')
    .eq('task_id', 'dd8f6032-bc26-4eda-ad99-413e26515978')
    .in('status', ['at-buffer', 'at-shop2-buffer'])
    .limit(10);

  console.log('Sample cut cards from dd8f6032:');
  for (const c of cards || []) {
    console.log(`Card ${c.id}: status=${c.status}, qty=${c.quantity}`);
    console.log(`  info: ${c.card_info}`);
  }

  // Also check if ANY card in dd8f6032 has MATERIALS_ISSUED tag
  const { data: allCards } = await supabase
    .from('work_cards')
    .select('id, card_info, status')
    .eq('task_id', 'dd8f6032-bc26-4eda-ad99-413e26515978');

  let withMatIssued = 0;
  let withSheetsDeducted = 0;
  let cutCardsCount = 0;

  for (const c of allCards || []) {
    const isCut = ['at-buffer', 'at-shop2-buffer', 'completed'].includes(c.status);
    if (isCut) cutCardsCount++;
    if ((c.card_info || '').includes('[MATERIALS_ISSUED:true]')) withMatIssued++;
    if ((c.card_info || '').includes('[SHEETS_DEDUCTED:true]')) withSheetsDeducted++;
  }

  console.log(`\nTask dd8f6032 summary:`);
  console.log(`Total cards: ${allCards?.length}`);
  console.log(`Cut cards: ${cutCardsCount}`);
  console.log(`Cards with [MATERIALS_ISSUED:true]: ${withMatIssued}`);
  console.log(`Cards with [SHEETS_DEDUCTED:true]: ${withSheetsDeducted}`);
}

run().catch(console.error);
