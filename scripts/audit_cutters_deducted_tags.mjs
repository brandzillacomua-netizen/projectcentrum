import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // Check 10 cut cards to see cutters info
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, task_id, card_info, cutters_used')
    .ilike('card_info', '%CUTTERS_DEDUCTED%')
    .limit(10);

  console.log('Sample cards with CUTTERS_DEDUCTED:');
  for (const c of cards || []) {
    console.log(`Card ${c.id}: cutters_used=${c.cutters_used}, info=${c.card_info}`);
  }

  // Check if inventory for cutters has ever been updated recently
  const { data: cutterRows } = await supabase
    .from('inventory')
    .select('id, name, total_qty, reserved_qty, updated_at')
    .ilike('name', '%фреза%')
    .in('name', [
      'Фреза кукурудза 2х3,175х10,5х38',
      'Фреза кукурудза 3х3,175х12х38',
      'Фреза кукурудза 4х4х12х38',
      'Фреза фасочна 6х50х90°'
    ]);

  console.log('\nCurrent Inventory Cutter Rows:');
  console.table(cutterRows);
}

run().catch(console.error);
