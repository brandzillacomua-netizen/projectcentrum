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
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const targetSubstrings = ['KH-10', 'KR-10', 'KR-Line', 'KHARAK'];
  
  const matches = noms.filter(n => targetSubstrings.some(sub => n.name.includes(sub)));
  console.log(`Found ${matches.length} matching nomenclatures:`);
  matches.forEach(m => console.log(`- ${m.name} (${m.id})`));

  for (const match of matches) {
    const { data: inv } = await supabase.from('inventory').select('*').eq('nomenclature_id', match.id);
    console.log(`\nInventory for ${match.name}:`);
    inv.forEach(i => {
      console.log(`  - Type: ${i.type}, Warehouse: ${i.warehouse}, Qty: ${i.total_qty}`);
    });
  }
}

run();
