import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

const stagingClient = createClient(
  'https://qpiysrkhvdgctaqmfsew.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFwaXlzcmtodmRnY3RhcW1mc2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
);

async function search3160() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: prodInv } = await prodClient.from('inventory').select('*').eq('total_qty', 3160);
  console.log('PROD with 3160:', prodInv);

  const { data: stagingInv } = await stagingClient.from('inventory').select('*').eq('total_qty', 3160);
  console.log('STAGING with 3160:', stagingInv);

  // Search all inventory with 10,5 in PROD vs STAGING
  const { data: prod105 } = await prodClient.from('inventory').select('*').ilike('name', '%10,5%');
  console.log('PROD 10,5:', prod105?.map(i => ({ id: i.id, nom_id: i.nomenclature_id, name: i.name, wh: i.warehouse, qty: i.total_qty })));

  const { data: staging105 } = await stagingClient.from('inventory').select('*').ilike('name', '%10,5%');
  console.log('STAGING 10,5:', staging105?.map(i => ({ id: i.id, nom_id: i.nomenclature_id, name: i.name, wh: i.warehouse, qty: i.total_qty })));
}

search3160().catch(console.error);
