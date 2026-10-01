const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function inspect() {
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });
  if (authErr) {
    console.error('Auth error:', authErr.message);
    return;
  }
  console.log('Authenticated successfully as:', authData.user.email);

  // Inspect inventory table
  const { data: inv, error: invErr, count } = await supabase
    .from('inventory')
    .select('id, name, warehouse, type, total_qty, reserved_qty', { count: 'exact' })
    .limit(20);

  if (invErr) {
    console.error('Error fetching inventory:', invErr.message);
  } else {
    console.log(`Inventory count: ${count}`);
    console.log('Sample rows:', JSON.stringify(inv, null, 2));
  }

  // Also check warehouse distribution
  let allInv = [];
  let page = 0;
  while (true) {
    const { data, error } = await supabase
      .from('inventory')
      .select('id, warehouse, total_qty, reserved_qty')
      .range(page * 1000, (page + 1) * 1000 - 1);
    if (error || !data || data.length === 0) break;
    allInv = allInv.concat(data);
    if (data.length < 1000) break;
    page++;
  }

  const warehouseCounts = {};
  const warehouseTotalQty = {};
  const warehouseNonZeroQty = {};
  const typeCounts = {};

  allInv.forEach(item => {
    const wh = item.warehouse || 'NULL';
    const tp = item.type || 'NULL';
    const qty = Number(item.total_qty) || 0;

    warehouseCounts[wh] = (warehouseCounts[wh] || 0) + 1;
    warehouseTotalQty[wh] = (warehouseTotalQty[wh] || 0) + qty;
    if (qty !== 0) {
      warehouseNonZeroQty[wh] = (warehouseNonZeroQty[wh] || 0) + 1;
    }

    typeCounts[tp] = (typeCounts[tp] || 0) + 1;
  });

  console.log('\nTotal inventory items across all warehouses:', allInv.length);
  console.log('Warehouse item counts:', warehouseCounts);
  console.log('Warehouse non-zero item counts:', warehouseNonZeroQty);
  console.log('Warehouse total quantities sum:', warehouseTotalQty);
  console.log('Type counts:', typeCounts);
}

inspect();
