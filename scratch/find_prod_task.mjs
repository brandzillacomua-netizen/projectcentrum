import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  {
    global: {
      headers: {
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }
  }
);

async function findProdTask() {
  const { data: authData, error: authErr } = await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });
  if (authErr) {
    console.error('Auth error:', authErr);
    return;
  }
  console.log('Auth success for:', authData.user.email);

  const { data: tasks, error } = await prodClient
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Tasks error:', error);
    return;
  }

  console.log('Found', tasks.length, 'tasks in PROD');
  for (const t of tasks) {
    const snap = t.plan_snapshot || {};
    for (const [nomId, item] of Object.entries(snap)) {
      if (item?.name?.includes('3-39') || item?.name?.includes('Київ')) {
        console.log('--- FOUND PROD TASK ---', {
          id: t.id,
          order_id: t.order_id,
          partName: item.name,
          plannedSheets: item.planned_sheets,
          sheets: item.sheets,
          plan: item.plan,
          need: item.need,
          material: item.material,
          sheets_t300: item.sheets_t300,
          sheets_t700: item.sheets_t700
        });

        const { data: reqs } = await prodClient
          .from('material_requests')
          .select('*')
          .eq('task_id', t.id);
        console.log('Material requests for this task:', reqs);

        const { data: allReqsForOrder } = await prodClient
          .from('material_requests')
          .select('*')
          .eq('order_id', t.order_id);
        console.log('Material requests for this order:', allReqsForOrder);
      }
    }
  }
}

findProdTask().catch(console.error);
