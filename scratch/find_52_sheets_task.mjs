import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  {
    global: {
      headers: {
        'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
      }
    }
  }
);

async function find52SheetsTask() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const { data: tasks } = await prodClient
    .from('tasks')
    .select('id, order_id, plan_snapshot, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  for (const t of tasks) {
    const snap = t.plan_snapshot || {};
    for (const [nomId, item] of Object.entries(snap)) {
      if (item?.name?.includes('3-39')) {
        console.log(`=== TASK ${t.id} (${t.created_at}) ===`);
        console.log('Part item:', item);

        const { data: reqs } = await prodClient
          .from('material_requests')
          .select('id, task_id, nomenclature_id, status, quantity, details, category')
          .eq('task_id', t.id);

        console.log('Material requests for this task:');
        reqs?.forEach(r => console.log('  Req:', r));
      }
    }
  }
}

find52SheetsTask().catch(console.error);
