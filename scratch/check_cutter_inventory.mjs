import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  {
    global: {
      headers: {
        'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE'
      }
    }
  }
);

async function checkCutterInventory() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const { data: noms } = await prodClient
    .from('nomenclatures')
    .select('id, name, type, category')
    .ilike('name', '%Фреза кукурудза 2х3,175х10,5х38%');

  console.log('Nomenclatures matching:', noms);

  if (noms && noms.length > 0) {
    for (const n of noms) {
      const { data: inv } = await prodClient
        .from('inventory')
        .select('*')
        .eq('nomenclature_id', n.id);
      console.log(`Inventory for ${n.name} (${n.id}):`, inv);
    }
  }

  // Also check all inventory records with name like '%кукурудза%'
  const { data: invByName } = await prodClient
    .from('inventory')
    .select('*')
    .ilike('name', '%10,5х38%');
  console.log('Inventory by name:', invByName);
}

checkCutterInventory().catch(console.error);
