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
  // Let's find tasks with batch_index or order_num matching 30062026-01
  const { data: tasks, error } = await supabase.from('tasks').select('*');
  if (error) {
    console.error(error);
    return;
  }
  const targetTask = tasks.find(t => t.id === '30062026-01' || (t.plan_snapshot && JSON.stringify(t.plan_snapshot).includes('30062026-01')));
  console.log("Target Task:", targetTask);

  const { data: orders } = await supabase.from('orders').select('*').eq('order_num', '30062026-01');
  console.log("Orders matching 30062026-01:", orders);

  // Let's query all requests for order/task that has screw M3x35 and quantity 12000
  const { data: mr } = await supabase.from('material_requests').select('*').eq('quantity', 12000);
  console.log("Material requests with qty 12000:", mr);
}

main();
