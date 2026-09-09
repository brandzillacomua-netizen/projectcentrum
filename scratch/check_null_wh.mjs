import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function checkNullWarehouse() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: inv } = await prodClient.from('inventory').select('*');
  const nullWh = inv.filter(i => !i.warehouse || i.warehouse === 'null' || i.warehouse === '');
  console.log('Null warehouse count:', nullWh.length);
  nullWh.forEach(i => console.log('Null wh row:', { id: i.id, name: i.name, nomId: i.nomenclature_id, qty: i.total_qty }));

  // Also check if any other row matches c48e7cef
  const c48 = inv.filter(i => String(i.nomenclature_id) === 'c48e7cef-0500-48bb-87b9-232f63f54116');
  console.log('c48 rows count:', c48.length);
  c48.forEach(i => console.log('c48 row:', { id: i.id, name: i.name, wh: i.warehouse, qty: i.total_qty, res: i.reserved_qty }));
}

checkNullWarehouse().catch(console.error);
