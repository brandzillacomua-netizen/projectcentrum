const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: orders } = await supabase.from('orders').select('id, order_num').limit(200);
  const found = orders.filter(o => o.order_num && o.order_num.includes('261001'));
  console.log('Orders with 261001:', found);
}
run();
