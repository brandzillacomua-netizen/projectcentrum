const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
    }
  }
});

async function run() {
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const part = noms.find(n => n.name.includes('Х-3-39'));
  console.log('Part:', part?.name, 'ID:', part?.id);

  // Get work cards
  const { data: cards } = await supabase.from('work_cards').select('*').eq('nomenclature_id', part?.id);
  console.log(`\nWork cards count: ${cards.length}`);
  cards.forEach(c => {
    console.log(`- ID: ${c.id}, Op: ${c.operation}, Status: ${c.status}, Qty: ${c.quantity}, UsedInShop2: ${c.used_in_shop2_qty}, TaskID: ${c.task_id}`);
  });
}

run();
