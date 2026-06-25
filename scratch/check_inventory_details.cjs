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
  const ids = [
    'dc154eb4-a568-4944-8608-9cb0dae1180e', // KH-10(210)-Х-4-109
    '076ba504-b3f6-4ec8-8844-fe9515077d9c'  // KR-Line-210-415-В-3-28
  ];
  
  for (const id of ids) {
    const { data: inv } = await supabase.from('inventory').select('*').eq('nomenclature_id', id);
    console.log(`\nInventory for ID ${id}:`);
    inv.forEach(i => {
      console.log(`  - Type: ${i.type}, Warehouse: ${i.warehouse}, Qty: ${i.total_qty}, Reserved: ${i.reserved_qty}`);
    });
  }
}

run();
