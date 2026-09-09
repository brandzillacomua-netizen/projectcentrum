import { createClient } from '@supabase/supabase-js';

const stagingClient = createClient(
  'https://qpiysrkhvdgctaqmfsew.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODg5NzEzNSwiZXhwIjoyMTA0NDczMTM1fQ.VrtSmhZNBpPjOolQk9wML9ImpfD4mB4yyEJxF_AvAKE'
);

async function checkStaging() {
  const { data: inv, error: invErr } = await stagingClient.from('inventory').select('*').limit(20);
  console.log('Staging inventory sample:', inv, invErr);

  const { data: cutters } = await stagingClient.from('inventory').select('*').ilike('name', '%Фреза%');
  console.log('Staging cutter inventory count:', cutters?.length);
  cutters?.forEach(c => console.log(`  ${c.name} (${c.warehouse}): total=${c.total_qty}, res=${c.reserved_qty}`));

  // Check nomenclatures for cutters in staging
  const { data: noms } = await stagingClient.from('nomenclatures').select('id, name').ilike('name', '%Фреза чотирьохпера%');
  console.log('Staging чотирьохпера noms:', noms);
}

checkStaging().catch(console.error);
