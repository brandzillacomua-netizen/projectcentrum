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

async function inspectOrder() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const orderId = 'e7610d90-7f82-445d-a876-ab754d9397eb';
  const { data: reqs } = await prodClient.from('material_requests').select('*').eq('order_id', orderId);
  console.log('Material requests for order:', reqs);

  // Also check tasks under this order
  const { data: tasks } = await prodClient.from('tasks').select('id, status, created_at').eq('order_id', orderId);
  console.log('Tasks under this order:', tasks);
}

inspectOrder().catch(console.error);
