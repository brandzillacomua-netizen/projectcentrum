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
  
  // Get all work cards for this order
  const { data: tasks, error: tasksErr } = await supabase.from('tasks').select('id').eq('order_id', orderId);
  if (tasksErr) {
    console.error("Tasks query error:", tasksErr);
    return;
  }
  const taskIds = tasks ? tasks.map(t => t.id) : [];
  const { data: workCards, error: wcErr } = await supabase.from('work_cards').select('*');
  if (wcErr) {
    console.error("Work cards query error:", wcErr);
    return;
  }
  const orderWorkCards = workCards.filter(wc => wc.order_id === orderId || taskIds.includes(wc.task_id));

  console.log(`Total work cards for this order: ${orderWorkCards.length}`);

  // Let's print unique operations
  const operations = [...new Set(orderWorkCards.map(wc => wc.operation))];
  console.log("Operations present in cards:", operations);

  // Group by nomenclature and inspect card_info
  const grouped = {};
  orderWorkCards.forEach(wc => {
    if (!grouped[wc.nomenclature_id]) {
      grouped[wc.nomenclature_id] = [];
    }
    grouped[wc.nomenclature_id].push(wc);
  });

  const { data: nomenclatures } = await supabase.from('nomenclatures').select('id,name');

  for (const [nomId, cards] of Object.entries(grouped)) {
    const nom = nomenclatures.find(n => n.id === nomId) || { name: nomId };
    console.log(`\n=== Nomenclature: ${nom.name} ===`);
    console.log(`Total card records: ${cards.length}`);
    
    // Group by card_info to see if the same sheet is tracked in multiple cards
    const infoGroup = {};
    cards.forEach(c => {
      // Parse card number from card_info: e.g. "69/109"
      const match = c.card_info ? c.card_info.match(/^(\d+\/\d+)/) : null;
      const key = match ? match[1] : (c.card_info || 'no-info');
      if (!infoGroup[key]) {
        infoGroup[key] = [];
      }
      infoGroup[key].push(c);
    });

    console.log(`Unique card identifiers (e.g. sheets/batches): ${Object.keys(infoGroup).length}`);
    
    // Check some sample card_info with multiple records
    console.log("Sample card flows (first 3):");
    Object.entries(infoGroup).slice(0, 3).forEach(([key, list]) => {
      console.log(`  - Card "${key}":`);
      list.forEach(c => {
        console.log(`    * Op: ${c.operation}, Status: ${c.status}, Qty: ${c.quantity}, Machine: ${c.machine}`);
      });
    });
  }
}

run();
