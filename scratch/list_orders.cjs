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

async function run() {
  const { data: orders } = await supabase.from('orders').select('*, order_items(*)');
  console.log('Total orders:', orders?.length);
  for (const o of orders || []) {
    console.log(`Order ID: ${o.id}, Order Num: ${o.order_num}, Qty: ${o.quantity}, Nom ID: ${o.nomenclature_id}`);
    if (o.order_items && o.order_items.length > 0) {
      console.log('  Items:', o.order_items.map(oi => `Nom ID: ${oi.nomenclature_id}, Qty: ${oi.quantity}`));
    }
  }
}

run();
