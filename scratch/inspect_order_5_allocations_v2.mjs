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

  // 1. BZ reservations for 261001-5
  const { data: bzRes } = await supabase
    .from('bz_inventory_reservations')
    .select('*, nomenclatures_v2(name)')
    .eq('order_id', targetOrderId)
    .eq('status', 'allocated');

  console.log('--- BZ RESERVATIONS FOR 261001-5 ---');
  console.log(JSON.stringify(bzRes?.map(r => ({
    id: r.id,
    nomenclature_id: r.nomenclature_id,
    name: r.nomenclatures_v2?.name,
    requested_qty: r.requested_qty,
    allocated_qty: r.allocated_qty
  })), null, 2));

  // 2. Material requests for 261001-5
  const { data: matReqs } = await supabase
    .from('material_requests')
    .select('*')
    .eq('order_id', targetOrderId)
    .in('status', ['pending', 'approved', 'reserved', 'issued']);

  console.log('\n--- MATERIAL REQUESTS FOR 261001-5 ---');
  console.log(JSON.stringify(matReqs?.map(r => ({
    id: r.id,
    nomenclature_id: r.nomenclature_id,
    nomenclature_name: r.nomenclature_name,
    category: r.category,
    requested_qty: r.requested_qty,
    approved_qty: r.approved_qty,
    issued_qty: r.issued_qty,
    status: r.status
  })), null, 2));

  // 3. Work cards for 261001-5 to see if any SGP / buffer stock is assigned
  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, card_info, status, nomenclature_id, planned_qty, completed_qty, operation')
    .eq('order_id', targetOrderId);

  console.log('\n--- WORK CARDS FOR 261001-5 ---');
  console.log('Total Cards:', cards?.length);
  const sgpCards = cards?.filter(c => c.operation === 'Склад СГП' || String(c.card_info || '').includes('СГП'));
  console.log('SGP Cards count:', sgpCards?.length);
  console.log(JSON.stringify(sgpCards?.map(c => ({
    id: c.id,
    card_info: c.card_info,
    status: c.status,
    nomenclature_id: c.nomenclature_id,
    planned_qty: c.planned_qty
  })), null, 2));
}

main().catch(console.error);
