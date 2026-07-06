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
  
  // 1. Get pending requests
  const { data: reqs, error: rErr } = await supabase
    .from('material_requests')
    .select('*, nomenclatures(*)')
    .eq('order_id', orderId)
    .in('status', ['pending', 'processing']);

  if (rErr) {
    console.error('Reqs error:', rErr);
    return;
  }

  const nomIds = reqs.map(r => r.nomenclature_id).filter(Boolean);
  
  // 2. Fetch inventory for these nomenclatures
  const { data: invs, error: iErr } = await supabase
    .from('inventory')
    .select('*')
    .in('nomenclature_id', nomIds);

  if (iErr) {
    console.error('Inventory error:', iErr);
    return;
  }

  console.log('--- Real Stock Levels for Pending Items ---');
  reqs.forEach(r => {
    const nom = r.nomenclatures || { name: 'Unknown' };
    const stockItems = invs.filter(i => i.nomenclature_id === r.nomenclature_id);
    const totalQty = stockItems.reduce((acc, cur) => acc + (cur.total_qty || 0), 0);
    const reservedQty = stockItems.reduce((acc, cur) => acc + (cur.reserved_qty || 0), 0);
    
    console.log(`Nomenclature: ${nom.name} (${r.nomenclature_id})`);
    console.log(`  Requested Quantity: ${r.quantity}`);
    console.log(`  Current Total in Stock: ${totalQty}`);
    console.log(`  Reserved: ${reservedQty}`);
    console.log(`  Available: ${totalQty - reservedQty}`);
  });
}

run();
