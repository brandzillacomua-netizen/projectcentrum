const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function main() {
  const { data: orders, error: oErr } = await supabase.from('orders').select('*').eq('order_num', '08062026-01');
  if (oErr) {
    console.error('Order query error:', oErr);
    return;
  }
  console.log('Orders found:', orders);
  if (!orders || orders.length === 0) return;

  const orderId = orders[0].id;
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('*').eq('order_id', orderId);
  if (tErr) {
    console.error('Tasks query error:', tErr);
    return;
  }
  console.log('Tasks found:', JSON.stringify(tasks, null, 2));
}

main();
