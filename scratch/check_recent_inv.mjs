import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'REVOKED_MES_SECRET_DO_NOT_USE' } } }
);

async function checkRecentInventory() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: 'REVOKED_AUDIT_PASSWORD_DO_NOT_USE'
  });

  const { data: inv } = await prodClient
    .from('inventory')
    .select('*')
    .ilike('name', '%Фреза кукурудза 2х3,175х10,5х38%');
  console.log('All inventory rows for this cutter:', inv);

  // Check reception_docs or material_requests or stock adjustments
  const { data: logs } = await prodClient
    .from('inventory')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(15);
  console.log('Most recently updated inventory items in PROD:');
  logs?.forEach(l => console.log(`  ${l.name} (${l.warehouse}): total=${l.total_qty}, updated=${l.updated_at}`));
}

checkRecentInventory().catch(console.error);
