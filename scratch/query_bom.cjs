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

async function main() {
  const parentNomId = 'ff1bd4b1-17c9-408b-aefb-0ba8aaab7318';
  console.log("Querying bom_items directly...");
  const { data: bom, error } = await supabase.from('bom_items').select('*').eq('parent_id', parentNomId);
  if (error) {
    console.error(error);
    return;
  }
  console.log("BOM raw items:", bom);

  // Let's resolve nomenclature names
  if (bom && bom.length > 0) {
    const childIds = bom.map(b => b.child_id);
    const { data: noms } = await supabase.from('nomenclatures').select('id, name').in('id', childIds);
    console.log("Resolved BOM names:", bom.map(b => {
      const match = noms.find(n => n.id === b.child_id);
      return {
        child_id: b.child_id,
        name: match ? match.name : 'Unknown',
        qty: b.quantity_per_parent
      };
    }));
  }
}

main();
