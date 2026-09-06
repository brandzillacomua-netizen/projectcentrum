import { createClient } from '@supabase/supabase-js';

const client = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI', {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const { data: inv, error } = await client.from('inventory').select('*').limit(5000);
  if (error) {
    console.error('Error fetching inventory:', error);
    return;
  }
  console.log('Total inventory records fetched:', inv.length);

  // Group by nomenclature_id, type, warehouse
  const groupsWithWarehouse = new Map();
  const groupsWithoutWarehouse = new Map();

  inv.forEach(item => {
    const keyWithWh = `${item.nomenclature_id || 'null'}|${item.type || 'standard'}|${item.warehouse || 'null'}`;
    const keyWithoutWh = `${item.nomenclature_id || 'null'}|${item.type || 'standard'}`;

    if (!groupsWithWarehouse.has(keyWithWh)) groupsWithWarehouse.set(keyWithWh, []);
    groupsWithWarehouse.get(keyWithWh).push(item);

    if (!groupsWithoutWarehouse.has(keyWithoutWh)) groupsWithoutWarehouse.set(keyWithoutWh, []);
    groupsWithoutWarehouse.get(keyWithoutWh).push(item);
  });

  let dupesWithWh = 0;
  let redundantWithWh = 0;
  for (const [key, items] of groupsWithWarehouse.entries()) {
    if (items.length > 1) {
      dupesWithWh++;
      redundantWithWh += (items.length - 1);
      if (dupesWithWh <= 3) {
        console.log('\n[Dupe with same warehouse]:', key);
        items.forEach(it => console.log(`  -> ID: ${it.id} | name: ${it.name} | total: ${it.total_qty} | res: ${it.reserved_qty} | wh: ${it.warehouse} | created: ${it.created_at}`));
      }
    }
  }

  let dupesWithoutWh = 0;
  let redundantWithoutWh = 0;
  for (const [key, items] of groupsWithoutWarehouse.entries()) {
    if (items.length > 1) {
      dupesWithoutWh++;
      redundantWithoutWh += (items.length - 1);
    }
  }

  console.log('\n--- SUMMARY ---');
  console.log('Duplicate groups (same nomenclature_id + type + warehouse):', dupesWithWh, '| Redundant rows:', redundantWithWh);
  console.log('Duplicate groups (ignoring warehouse):', dupesWithoutWh, '| Redundant rows:', redundantWithoutWh);

  // Check if material_requests reference any of the duplicate IDs
  const dupeIds = [];
  for (const items of groupsWithWarehouse.values()) {
    if (items.length > 1) {
      // items.slice(1) are the redundant ones
      items.slice(1).forEach(it => dupeIds.push(it.id));
    }
  }

  console.log('\nChecking if material_requests reference redundant IDs...');
  const { data: referencingReqs } = await client.from('material_requests').select('id, inventory_id').in('inventory_id', dupeIds.slice(0, 50));
  console.log(`Found ${referencingReqs?.length || 0} material_requests pointing to sample redundant IDs`);
}

run();
