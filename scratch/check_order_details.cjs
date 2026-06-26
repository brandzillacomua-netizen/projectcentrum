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
  const orderId = '53741df6-bd90-476b-9000-2c4bec9e9080';
  
  // 1. Get order details
  const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
  console.log("=== ORDER ===");
  console.log(JSON.stringify(order, null, 2));

  // 2. Get nomenclature
  if (order && order.nomenclature_id) {
    const { data: nomenclature } = await supabase.from('nomenclatures').select('*').eq('id', order.nomenclature_id).single();
    console.log("\n=== NOMENCLATURE ===");
    console.log(JSON.stringify(nomenclature, null, 2));

    // 3. Get BOM items
    const { data: bomItems } = await supabase.from('bom_items').select('*').eq('parent_id', order.nomenclature_id);
    console.log("\n=== BOM ITEMS ===");
    console.log(JSON.stringify(bomItems, null, 2));

    if (bomItems && bomItems.length > 0) {
      const childIds = bomItems.map(b => b.child_id);
      const { data: childNoms } = await supabase.from('nomenclatures').select('*').in('id', childIds);
      console.log("\n=== CHILD NOMENCLATURES ===");
      childNoms.forEach(c => {
        const bomLink = bomItems.find(b => b.child_id === c.id);
        console.log(`- ID: ${c.id}, Name: ${c.name}, Type: ${c.type}, Qty per parent: ${bomLink ? bomLink.quantity : 'unknown'}`);
      });
    }
  }

  // 4. Get tasks
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', orderId);
  console.log("\n=== TASKS ===");
  tasks.forEach(t => {
    console.log(`Task ID: ${t.id}, Step: ${t.step}, Status: ${t.status}`);
    if (t.plan_snapshot) {
      console.log(`Plan snapshot (keys/preview):`, Object.keys(t.plan_snapshot));
      console.log(`Plan snapshot values:`, JSON.stringify(t.plan_snapshot, null, 2));
    }
  });

  // 5. Get work cards
  const { data: workCards } = await supabase.from('work_cards').select('*');
  const taskIds = tasks.map(t => t.id);
  const filteredCards = workCards.filter(wc => taskIds.includes(wc.task_id));
  console.log("\n=== WORK CARDS FOR TASKS ===");
  console.log(`Found ${filteredCards.length} work cards.`);
  filteredCards.forEach(wc => {
    console.log(`Card ID: ${wc.id}, Task ID: ${wc.task_id}, Name/Code: ${wc.card_number || wc.name || wc.id}, Status: ${wc.status}, Quantity/Details: ${JSON.stringify(wc.items || wc.qty || wc.details || wc)}`);
  });
}

run();
