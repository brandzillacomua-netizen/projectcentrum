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
  const { data: cards } = await supabase.from('work_cards').select('*');
  const { data: tasks } = await supabase.from('tasks').select('*');
  const { data: noms } = await supabase.from('nomenclatures').select('*');

  const orders = [
    { id: '53741df6-bd90-476b-9000-2c4bec9e9080', num: '22062026-03 (10000)' },
    { id: '227e62dc-8c6e-42a0-bee8-9ad8743169c7', num: '25062026-02 (2000)' }
  ];

  for (const o of orders) {
    console.log(`\n=================== ORDER ${o.num} ===================`);
    const oTasks = tasks.filter(t => t.order_id === o.id);
    const oTaskIds = oTasks.map(t => t.id);
    const oCards = cards.filter(c => oTaskIds.includes(c.task_id));
    console.log(`Tasks: ${oTasks.length}, Work cards: ${oCards.length}`);
    
    // Group work cards by part and status
    const grouped = {};
    for (const card of oCards) {
      const nom = noms.find(n => n.id === card.nomenclature_id);
      const name = nom ? nom.name : card.nomenclature_id;
      if (!grouped[name]) grouped[name] = [];
      grouped[name].push(card);
    }
    
    for (const [name, list] of Object.entries(grouped)) {
      console.log(`  Part: ${name}`);
      for (const c of list) {
        console.log(`    Op: ${c.operation}, Status: ${c.status}, Qty: ${c.quantity}, Used in Shop2: ${c.used_in_shop2_qty}`);
      }
    }
  }
}

run();
