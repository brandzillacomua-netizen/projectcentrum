import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function inspect() {
  const auth = await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });
  if (auth.error) {
    console.error('Auth error:', auth.error);
    return;
  }
  console.log('Authenticated successfully as', auth.data.user.email);

  // 1. All sheet inventory items
  const { data: sheets, error: sErr } = await supabase
    .from('inventory')
    .select('id, name, nomenclature_id, type, warehouse, total_qty, reserved_qty, updated_at')
    .or('name.ilike.%лист%,name.ilike.%sheet%')
    .order('name');

  console.log('\n=== SHEETS IN INVENTORY ===');
  console.table(sheets);

  // 2. All material_requests
  const { data: reqs, error: rErr } = await supabase
    .from('material_requests')
    .select('id, order_id, task_id, card_id, nomenclature_id, inventory_id, quantity, status, details, category, created_at')
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  console.log(`\n=== ACTIVE MATERIAL REQUESTS (${reqs?.length || 0}) ===`);
  console.log(reqs);

  // 3. All bz reservations
  const { data: bzRes } = await supabase
    .from('bz_inventory_reservations')
    .select('id, order_id, task_id, nomenclature_id, allocated_qty, status')
    .eq('status', 'allocated');
  console.log(`\n=== ACTIVE BZ RESERVATIONS (${bzRes?.length || 0}) ===`);
  console.log(bzRes);

  // 4. Cutting cards (Розкрій)
  const { data: cutCards, error: cErr } = await supabase
    .from('work_cards')
    .select('id, task_id, order_id, nomenclature_id, operation, status, quantity, actual_sheets, card_info, created_at, updated_at')
    .ilike('operation', '%розкрій%')
    .order('updated_at', { ascending: false })
    .limit(50);

  console.log(`\n=== RECENT CUTTING CARDS (limit 50) ===`);
  console.log(cutCards?.slice(0, 15));
  
  // Status breakdown of cutting cards
  const statusCounts = {};
  cutCards?.forEach(c => {
    statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
  });
  console.log('\nCutting cards status counts in top 50:', statusCounts);
}

inspect().catch(console.error);
