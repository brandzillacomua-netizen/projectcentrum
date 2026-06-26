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
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const target = noms.find(n => n.name.includes('П-7-46'));
  console.log('Target part:', target?.name, target?.id);
  
  const partCards = cards.filter(c => c.nomenclature_id === target?.id);
  console.log(`Total work cards for this part: ${partCards.length}`);
  
  const { data: tasks } = await supabase.from('tasks').select('*');
  for (const c of partCards) {
    const t = tasks.find(x => x.id === c.task_id);
    console.log(`Card ID: ${c.id}, Qty: ${c.quantity}, Status: ${c.status}, Op: ${c.operation}, Task ID: ${c.task_id}, Order ID: ${t?.order_id}`);
  }
}

run();
