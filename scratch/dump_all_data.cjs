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
  const { data: orders } = await supabase.from('orders').select('*');
  console.log("=== ALL ORDERS ===");
  orders.forEach(o => {
    console.log(`ID: ${o.id}\nOrder Num: ${o.order_num}\nCustomer: ${o.customer}\nNomenclature ID: ${o.nomenclature_id}\nQuantity: ${o.quantity}\nStatus: ${o.status}\n`);
  });

  const { data: tasks } = await supabase.from('tasks').select('*');
  console.log("=== ALL TASKS ===");
  tasks.forEach(t => {
    console.log(`ID: ${t.id}\nOrder ID: ${t.order_id}\nStep: ${t.step}\nStatus: ${t.status}\nGood Qty: ${t.good_qty}\nScrap Qty: ${t.scrap_qty}\nPlanned Sets: ${t.planned_sets}\n`);
  });
}

run();
