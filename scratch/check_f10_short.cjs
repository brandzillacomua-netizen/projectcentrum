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
  const f10Orders = orders.filter(o => o.nomenclature_id === '26a77a50-d932-4a02-a65d-b4cd608ec6ac');
  console.log('--- F10 ORDERS ---');
  for (const o of f10Orders) {
    console.log(`Order ID: ${o.id}, Order Num: ${o.order_num}, Qty: ${o.quantity}`);
  }

  const { data: tasks } = await supabase.from('tasks').select('*').in('order_id', f10Orders.map(o => o.id));
  console.log('--- F10 TASKS ---');
  for (const t of tasks || []) {
    console.log(`Task ID: ${t.id}, Order ID: ${t.order_id}, Planned Sets: ${t.planned_sets}, Status: ${t.status}, Step: ${t.step}, plan_snapshot keys count: ${t.plan_snapshot ? Object.keys(t.plan_snapshot).length : 'none'}`);
  }

  console.log('--- INVENTORY FOR F10 PARTS ---');
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const { data: bomItems } = await supabase.from('bom_items').select('*').eq('parent_id', '26a77a50-d932-4a02-a65d-b4cd608ec6ac');
  const childIds = bomItems.map(b => b.child_id);
  
  const { data: inventory } = await supabase.from('inventory').select('*').in('nomenclature_id', childIds);
  const parentNom = noms.find(n => n.id === '26a77a50-d932-4a02-a65d-b4cd608ec6ac');
  console.log(`Product: ${parentNom?.name}`);

  for (const childId of childIds) {
    const childNom = noms.find(n => n.id === childId);
    const stock = inventory.filter(i => i.nomenclature_id === childId && (Number(i.total_qty) > 0));
    if (stock.length > 0) {
      console.log(`  - Child Part: ${childNom?.name}`);
      for (const st of stock) {
        console.log(`    Stock in ${st.warehouse} (${st.type}): total_qty=${st.total_qty}, reserved_qty=${st.reserved_qty}`);
      }
    }
  }
}

run();
