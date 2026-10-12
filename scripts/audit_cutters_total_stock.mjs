import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Check inventory audit / update history or cutter restoration
  const { data: invRows } = await supabase
    .from('inventory')
    .select('id, name, total_qty, reserved_qty, warehouse, updated_at')
    .ilike('name', '%фреза%')
    .or('warehouse.eq.operational,warehouse.is.null')
    .order('name');

  console.log('Operational Cutters in DB:');
  for (const r of invRows || []) {
    if (r.total_qty > 0 || r.reserved_qty > 0) {
      console.log(`${r.name}: total=${r.total_qty}, reserved=${r.reserved_qty}, updated_at=${r.updated_at}`);
    }
  }

  // 2. Check total cutters_used from work_card_history
  const { data: history } = await supabase
    .from('work_card_history')
    .select('id, card_info, cutters_used, completed_at')
    .gt('cutters_used', 0)
    .limit(10);

  console.log('\nSample work_card_history with cutters_used > 0:', history?.length);
  for (const h of history || []) {
    console.log(h);
  }
}

run().catch(console.error);
