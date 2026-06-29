const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, order_num, customer')
    .limit(50);
    
  if (error) {
    console.error(error);
    return;
  }
  
  console.log('Orders in database:');
  orders.forEach(o => {
    console.log(`- ID: ${o.id}, Num: "${o.order_num}", Cust: ${o.customer}`);
  });
}

run();
