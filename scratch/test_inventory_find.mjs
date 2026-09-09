import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function testInventoryFind() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  // How does the app load inventory in dataProfiles or dataFetchers?
  const { data: inventory } = await prodClient.from('inventory').select('*');
  console.log('Total inventory rows in prod:', inventory?.length);

  const nomId = 'c48e7cef-0500-48bb-87b9-232f63f54116';
  const allForNom = inventory.filter(i => String(i.nomenclature_id) === String(nomId));
  console.log('All inventory rows for this nom in loaded inventory:', allForNom);

  // Original getStockForNom
  const getStockForNomOld = (id) => {
    const inv = (inventory || []).find(i => (i.warehouse === 'operational' || !i.warehouse) && String(i.nomenclature_id) === String(id));
    return inv ? Math.max(0, (Number(inv.total_qty) || 0) - (Number(inv.reserved_qty) || 0)) : 0;
  };
  console.log('Old getStockForNom:', getStockForNomOld(nomId));
}

testInventoryFind().catch(console.error);
