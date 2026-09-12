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

async function inspectTaskA33() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const taskId = 'a33b29a4-d783-45dd-a88b-92c8150320eb';
  const { data: t } = await prodClient.from('tasks').select('*').eq('id', taskId).single();
  const { data: reqs } = await prodClient.from('material_requests').select('*').eq('task_id', taskId);

  console.log('Task:', { id: t.id, order_id: t.order_id, status: t.status });
  console.log('Material requests:', reqs);
}

inspectTaskA33().catch(console.error);
