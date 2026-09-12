import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
    }
  }
});

async function main() {
  const { data: orderData, error: orderErr } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('order_num', '27062026-01')
    .single();

  if (orderErr) {
    console.error('Order err:', orderErr);
    return;
  }

  console.log('ORDER DETAILS:');
  console.log('Order ID:', orderData.id);
  console.log('Quantity:', orderData.quantity);
  console.log('Order Items:', orderData.order_items);

  const { data: tasksData, error: tasksErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', orderData.id);

  if (tasksErr) {
    console.error('Tasks err:', tasksErr);
    return;
  }

  console.log('\nTASKS DETAILS:');
  tasksData.forEach(t => {
    console.log('--- Task ID:', t.id, 'Step:', t.step, 'Status:', t.status);
    console.log('Plan Snapshot:', JSON.stringify(t.plan_snapshot, null, 2));
  });
}

main();
