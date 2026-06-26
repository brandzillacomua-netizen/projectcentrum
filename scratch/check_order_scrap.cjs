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
  
  // Get all work card history for tasks of this order
  const { data: tasks } = await supabase.from('tasks').select('id').eq('order_id', orderId);
  const taskIds = tasks.map(t => t.id);
  
  const { data: history } = await supabase.from('work_card_history').select('*');
  const orderHistory = history.filter(h => h.order_id === orderId || taskIds.includes(h.task_id));

  console.log("=== SCRAP REPORT FOR ORDER ===");
  
  const scrapByNom = {};
  orderHistory.forEach(h => {
    const scrap = Number(h.scrap_qty) || 0;
    if (scrap > 0) {
      if (!scrapByNom[h.nomenclature_id]) {
        scrapByNom[h.nomenclature_id] = 0;
      }
      scrapByNom[h.nomenclature_id] += scrap;
      console.log(`Card: ${h.card_info || h.card_id}, Nom ID: ${h.nomenclature_id}, Stage: ${h.stage_name}, Scrap Qty: ${scrap}`);
    }
  });

  const { data: noms } = await supabase.from('nomenclatures').select('id,name');
  console.log("\n=== TOTAL SCRAP BY NOMENCLATURE ===");
  for (const [id, qty] of Object.entries(scrapByNom)) {
    const nom = noms.find(n => n.id === id);
    console.log(`- ${nom ? nom.name : id}: ${qty} pcs scrapped`);
  }
}

run();
