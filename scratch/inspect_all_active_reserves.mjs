import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  // 1. Fetch all allocated BZ reservations
  const { data: bzRes, error: bzErr } = await supabase
    .from('bz_inventory_reservations')
    .select('*, nomenclatures(name)')
    .eq('status', 'allocated');

  console.log('--- ALLOCATED BZ RESERVATIONS ---', bzErr || '');
  console.log(bzRes?.map(r => ({
    id: r.id,
    order_id: r.order_id,
    task_id: r.task_id,
    nomenclature: r.nomenclatures?.name,
    allocated_qty: r.allocated_qty
  })));

  // 2. Fetch all active material requests
  const { data: matReqs, error: matErr } = await supabase
    .from('material_requests')
    .select('*, nomenclatures(name)')
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  console.log('\n--- ACTIVE MATERIAL REQUESTS ---', matErr || '');
  console.log(matReqs?.map(r => ({
    id: r.id,
    order_id: r.order_id,
    task_id: r.task_id,
    category: r.category,
    nomenclature: r.nomenclatures?.name,
    requested_qty: r.requested_qty,
    approved_qty: r.approved_qty,
    issued_qty: r.issued_qty,
    status: r.status
  })));

  // 3. Fetch inventory count where total_qty > 0 or reserved_qty > 0
  const { data: inv, error: invErr } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty')
    .or('total_qty.gt.0,reserved_qty.gt.0');

  console.log('\n--- NON-ZERO INVENTORY ITEMS ---', invErr || '');
  console.log(`Count: ${inv?.length}`);
  console.log(inv?.slice(0, 30));
}

main().catch(console.error);
