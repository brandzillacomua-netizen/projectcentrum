import { createClient } from '@supabase/supabase-js';

const stagingClient = createClient(
  'https://qpiysrkhvdgctaqmfsew.supabase.co',
  process.env.STAGING_SERVICE_ROLE_KEY || ''
);

async function checkStagingCutters() {
  const { data: inv, error } = await stagingClient.from('inventory').select('*').in('name', [
    'Фреза чотирьохпера 2х4х6х50',
    'Фреза чотирьохпера 2х4х12х50',
    'Фреза 2мм спіральна 2-західна (Німеччина)',
    'Фреза чотирьохпера 2х4х5х50',
    'Фреза кукурудза 2х3,175х10,5х38'
  ]);
  console.log('Error:', error);
  console.log('Staging items:', inv?.map(i => ({ name: i.name, wh: i.warehouse, total: i.total_qty, nom_id: i.nomenclature_id })));
}

checkStagingCutters().catch(console.error);
