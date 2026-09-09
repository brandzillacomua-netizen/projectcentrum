import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
);

const stagingClient = createClient(
  'https://qpiysrkhvdgctaqmfsew.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5NzEzNSwiZXhwIjoyMTA0NDczMTM1fQ.VrtSmhZNBpPjOolQk9wML9ImpfD4mB4yyEJxF_AvAKE'
);

async function search(client, label) {
  console.log(`=== Searching in ${label} ===`);
  const { data: noms } = await client
    .from('nomenclatures')
    .select('id, name, material_type, units_per_sheet')
    .or('name.ilike.%39%,name.ilike.%3-39%');
  console.log(`${label} noms:`, noms?.length);
  const found = noms?.filter(n => n.name.includes('3-39') || n.name.includes('39'));
  console.log(`${label} matching:`, found);

  const { data: tasks } = await client
    .from('tasks')
    .select('id, task_id, status, plan_snapshot, order_id')
    .order('created_at', { ascending: false })
    .limit(10);
  
  tasks?.forEach(t => {
    const keys = Object.keys(t.plan_snapshot || {});
    keys.forEach(k => {
      const item = t.plan_snapshot[k];
      if (item?.name?.includes('3-39') || item?.name?.includes('Київ')) {
        console.log(`${label} task ${t.task_id} (${t.id}) has item:`, item.name, 'planSheets:', item.planned_sheets, 'planQty:', item.plan);
      }
    });
  });

  const { data: reqs } = await client
    .from('material_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(15);
  console.log(`${label} recent material_requests:`, reqs?.map(r => ({
    id: r.id,
    task_id: r.task_id,
    order_id: r.order_id,
    nom_id: r.nomenclature_id,
    status: r.status,
    qty: r.quantity,
    issued_qty: r.issued_quantity,
    details: r.details
  })));
}

async function run() {
  await search(prodClient, 'PROD');
  await search(stagingClient, 'STAGING');
}

run().catch(console.error);
