import { createClient } from '@supabase/supabase-js';

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
  const { data: noms } = await supabase.from('nomenclatures').select('id, name, type');
  const { data: boms } = await supabase.from('bom_items').select('*');

  const nomMap = {};
  noms.forEach(n => {
    nomMap[n.id] = n;
  });

  const products = noms.filter(n => n.type === 'product');
  console.log(`Found ${products.length} products in DB.`);

  products.forEach(p => {
    const pBoms = boms.filter(b => b.parent_id === p.id);
    if (pBoms.length > 0) {
      console.log(`Product: "${p.name}"`);
      pBoms.forEach(b => {
        const child = nomMap[b.child_id];
        console.log(`  -> ${child ? child.name : 'Unknown'} (qty: ${b.quantity_per_parent})`);
      });
    }
  });
}

run();
