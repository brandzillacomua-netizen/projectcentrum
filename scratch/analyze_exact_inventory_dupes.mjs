import { createClient } from '@supabase/supabase-js';

const client = createClient('https://hurzutjytlcvtbvihnry.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI', {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const { data: inv, error } = await client.from('inventory').select('*').limit(5000);
  if (error) {
    console.error(error);
    return;
  }

  const groups = new Map();
  inv.forEach(item => {
    const key = `${item.nomenclature_id || 'null'}|${item.type || 'standard'}|${item.warehouse || 'main'}|${item.pocket_owner || 'none'}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });

  let trueDuplicatesCount = 0;
  let redundantRows = 0;
  for (const [key, items] of groups.entries()) {
    if (items.length > 1) {
      trueDuplicatesCount++;
      redundantRows += (items.length - 1);
      console.log('\nTrue duplicate group:', key, `(${items.length} rows)`);
      items.forEach(it => {
        console.log(`  -> ID: ${it.id} | name: ${it.name} | total: ${it.total_qty} | res: ${it.reserved_qty} | created: ${it.created_at}`);
      });
    }
  }

  console.log('\n--- EXACT TRUE DUPLICATES ---');
  console.log('True duplicate groups:', trueDuplicatesCount, '| Total redundant rows to merge:', redundantRows);
}

run();
