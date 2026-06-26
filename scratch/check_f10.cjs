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
  console.log('--- ORDERS ---');
  const f10Orders = orders.filter(o => 
    (o.order_num && o.order_num.includes('ф10')) || 
    (o.order_num && o.order_num.includes('F10')) ||
    o.quantity === 2000 || o.quantity === 10000 ||
    o.order_items?.some(oi => oi.quantity === 2000 || oi.quantity === 10000)
  );
  for (const o of f10Orders) {
    console.log(`Order ID: ${o.id}, Order Num: ${o.order_num}, Qty: ${o.quantity}, Nom ID: ${o.nomenclature_id}`);
    console.log('Order items:', o.order_items);
  }

  console.log('--- TASKS FOR THESE ---');
  const orderIds = f10Orders.map(o => o.id);
  const { data: tasks } = await supabase.from('tasks').select('*').in('order_id', orderIds);
  for (const t of tasks || []) {
    console.log(`Task ID: ${t.id}, Order ID: ${t.order_id}, Planned Sets: ${t.planned_sets}, Status: ${t.status}, Step: ${t.step}`);
  }

  // Let's get the nomenclatures to see their names
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const { data: inventory } = await supabase.from('inventory').select('*');
  
  // Find child items for these products
  const { data: bomItems } = await supabase.from('bom_items').select('*');
  
  for (const o of f10Orders) {
    let prodId = o.nomenclature_id || o.order_items?.[0]?.nomenclature_id;
    if (!prodId) continue;
    const parentNom = noms.find(n => n.id === prodId);
    console.log(`\nProduct: ${parentNom?.name} (${parentNom?.id})`);
    
    // Find BOM child parts
    const children = bomItems.filter(b => b.parent_id === prodId);
    console.log(`BOM children count: ${children.length}`);
    for (const child of children) {
      const childNom = noms.find(n => n.id === child.child_id);
      const stock = inventory.filter(i => i.nomenclature_id === child.child_id);
      console.log(`  - Child Part: ${childNom?.name} (${childNom?.code}), qty_per_parent: ${child.quantity_per_parent}`);
      for (const st of stock) {
        console.log(`    Stock in ${st.warehouse} (${st.type}): total_qty=${st.total_qty}, reserved_qty=${st.reserved_qty}`);
      }
    }
  }
}

run();
