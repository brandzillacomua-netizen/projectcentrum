import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  // 1. Get the 4 cutter inventory items
  const cutterNames = [
    'Фреза кукурудза 2х3,175х10,5х38',
    'Фреза кукурудза 3х3,175х12х38',
    'Фреза кукурудза 4х4х12х38',
    'Фреза фасочна 6х50х90°'
  ];

  const { data: invItems } = await supabase
    .from('inventory')
    .select('*')
    .in('name', cutterNames)
    .or('warehouse.eq.operational,warehouse.is.null');

  console.log('=== TARGET CUTTER INVENTORY ITEMS ===');
  for (const i of invItems || []) {
    console.log(`\n--------------------------------------------------------------`);
    console.log(`CUTTER: "${i.name}" (ID: ${i.id}, nom_id: ${i.nomenclature_id})`);
    console.log(`  Total in DB: ${i.total_qty}, Reserved in DB: ${i.reserved_qty}, Available: ${i.total_qty - i.reserved_qty}`);

    // Find all active requests matching this item (by inventory_id or nomenclature_id or details)
    const { data: reqs } = await supabase
      .from('material_requests')
      .select('*')
      .in('status', ['pending', 'approved', 'reserved', 'issued'])
      .or(`inventory_id.eq.${i.id},nomenclature_id.eq.${i.nomenclature_id}`);

    // Also find by name substring
    const { data: nameReqs } = await supabase
      .from('material_requests')
      .select('*')
      .in('status', ['pending', 'approved', 'reserved', 'issued'])
      .ilike('details', `%${i.name}%`);

    const allMatchedReqs = Array.from(new Map([...(reqs || []), ...(nameReqs || [])].map(r => [r.id, r])).values());

    console.log(`  Matched Active Requests: ${allMatchedReqs.length}`);
    const byTask = {};
    let totalReqSum = 0;
    for (const r of allMatchedReqs) {
      totalReqSum += Number(r.quantity) || 0;
      byTask[r.task_id] = byTask[r.task_id] || { sum: 0, statuses: {}, reqs: [] };
      byTask[r.task_id].sum += Number(r.quantity) || 0;
      byTask[r.task_id].statuses[r.status] = (byTask[r.task_id].statuses[r.status] || 0) + (Number(r.quantity) || 0);
      byTask[r.task_id].reqs.push(r);
    }

    console.log(`  Total requests quantity sum: ${totalReqSum} (matches DB reserved: ${i.reserved_qty === totalReqSum})`);
    for (const [taskId, tData] of Object.entries(byTask)) {
      const { data: task } = await supabase.from('tasks').select('id, naryad_number, step, status').eq('id', taskId).maybeSingle();
      console.log(`    Task ${task?.naryad_number || taskId} [step: ${task?.step}, status: ${task?.status}]: sum=${tData.sum}, by status:`, tData.statuses);
    }
  }
}

run().catch(console.error);
