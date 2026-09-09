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

async function checkBoth() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: prodInv } = await prodClient.from('inventory').select('*').eq('nomenclature_id', 'c48e7cef-0500-48bb-87b9-232f63f54116');
  console.log('PROD inv for c48e7cef:', prodInv);

  const { data: stagingInv } = await stagingClient.from('inventory').select('*').eq('nomenclature_id', 'c48e7cef-0500-48bb-87b9-232f63f54116');
  console.log('STAGING inv for c48e7cef:', stagingInv);

  // Also search by name in both
  const { data: prodNoms } = await prodClient.from('nomenclatures').select('*').ilike('name', '%2х3,175х10,5х38%');
  console.log('PROD nom for 2х3,175х10,5х38:', prodNoms);

  const { data: stagingNoms } = await stagingClient.from('nomenclatures').select('*').ilike('name', '%2х3,175х10,5х38%');
  console.log('STAGING nom for 2х3,175х10,5х38:', stagingNoms);
}

checkBoth().catch(console.error);
