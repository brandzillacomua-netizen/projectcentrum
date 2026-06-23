const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI', {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function test() {
  const { data: noms } = await supabase.from('nomenclatures').select('*');
  const parent = noms.find(n => n.name.includes('Рама F10'));
  if (!parent) {
    console.log('Parent product not found');
    return;
  }
  console.log('Parent product:', parent.name, 'ID:', parent.id);

  const { data: bom } = await supabase.from('bom_items').select('*').eq('parent_id', parent.id);
  console.log('BOM items count:', bom.length);

  const { data: inv } = await supabase.from('inventory').select('*').in('nomenclature_id', bom.map(b => b.child_id));
  
  bom.forEach(b => {
    const childNom = noms.find(n => n.id === b.child_id);
    const childInv = inv.filter(i => i.nomenclature_id === b.child_id && (i.type === 'finished' || i.warehouse === 'sgp' || i.warehouse === 'SGP'));
    const totalSgp = childInv.reduce((sum, i) => sum + Number(i.total_qty || 0), 0);
    const qtyPerProduct = Number(b.quantity_per_parent || 1);
    const potential = Math.floor(totalSgp / qtyPerProduct);
    console.log(`Part: ${childNom?.name} | QtyPerProduct: ${qtyPerProduct} | SGP: ${totalSgp} | Potential: ${potential}`);
  });
}
test();
