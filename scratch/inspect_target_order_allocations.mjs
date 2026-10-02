import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const targetOrderId = '62330578-eb54-401c-8258-c2efd660780e';

  // Order info
  const { data: order } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('id', targetOrderId)
    .single();

  console.log('--- ORDER 261001-5 ---');
  console.log('Order Num:', order?.order_num, 'Status:', order?.status);

  // Active BZ reservations
  const { data: bzRes } = await supabase
    .from('bz_inventory_reservations')
    .select('*, nomenclatures(name, unit)')
    .eq('order_id', targetOrderId)
    .eq('status', 'allocated');

  console.log('\n--- ACTIVE BZ RESERVATIONS FOR 261001-5 ---');
  console.log(JSON.stringify(bzRes?.map(r => ({
    id: r.id,
    nomenclature: r.nomenclatures?.name,
    requested_qty: r.requested_qty,
    allocated_qty: r.allocated_qty
  })), null, 2));

  // Material requests
  const { data: matReqs } = await supabase
    .from('material_requests')
    .select('*, nomenclatures(name, unit)')
    .eq('order_id', targetOrderId)
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  console.log('\n--- MATERIAL REQUESTS FOR 261001-5 ---');
  console.log(JSON.stringify(matReqs?.map(r => ({
    id: r.id,
    nomenclature: r.nomenclatures?.name,
    category: r.category,
    requested_qty: r.requested_qty,
    approved_qty: r.approved_qty,
    issued_qty: r.issued_qty,
    status: r.status
  })), null, 2));

  // Work cards
  const { data: cards } = await supabase
    .from('work_cards')
    .select('*')
    .eq('order_id', targetOrderId);

  console.log('\n--- WORK CARDS FOR 261001-5 ---');
  console.log('Total Cards:', cards?.length);
  const cardsByStatus = {};
  cards?.forEach(c => {
    cardsByStatus[c.status] = (cardsByStatus[c.status] || 0) + 1;
  });
  console.log('Cards by status:', cardsByStatus);

  // Inventory snapshot
  const { data: inventory } = await supabase
    .from('inventory')
    .select('id, nomenclature_id, name, type, warehouse, total_qty, reserved_qty, nomenclatures(name)')
    .or('total_qty.gt.0,reserved_qty.gt.0');

  console.log('\n--- CURRENT INVENTORY WITH NON-ZERO BALANCES ---');
  console.log(`Total non-zero inventory rows: ${inventory?.length}`);
  console.log(JSON.stringify(inventory?.map(i => ({
    id: i.id,
    name: i.name || i.nomenclatures?.name,
    type: i.type,
    warehouse: i.warehouse,
    total_qty: i.total_qty,
    reserved_qty: i.reserved_qty
  })), null, 2));
}

main().catch(console.error);
