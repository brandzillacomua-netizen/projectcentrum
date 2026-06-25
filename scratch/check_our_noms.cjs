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
  const { data: inv } = await supabase.from('inventory').select('*');
  
  console.log('Inventory items containing "широк" or "210":');
  const matched = inv.filter(i => {
    const name = (i.name || '').toLowerCase();
    return name.includes('широк') || name.includes('210');
  });

  matched.forEach(i => {
    console.log(`ID: ${i.id} | Name: "${i.name}" | Type: ${i.type} | WH: ${i.warehouse} | Qty: ${i.total_qty} | NomID: ${i.nomenclature_id}`);
  });
}

run();
