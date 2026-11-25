import { createClient } from '@supabase/supabase-js';

const stagingClient = createClient(
  'https://qpiysrkhvdgctaqmfsew.supabase.co',
  process.env.STAGING_SERVICE_ROLE_KEY || ''
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
