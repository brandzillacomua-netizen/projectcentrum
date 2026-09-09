import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function findDuplicateNoms() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: noms } = await prodClient.from('nomenclatures').select('*');
  const matching = noms.filter(n => n.name.includes('10,5') || n.name.includes('10.5'));
  console.log('All matching noms for 10,5:', matching.map(n => ({ id: n.id, name: n.name, type: n.type })));

  // Also check all noms containing "2х3,175"
  const matching2 = noms.filter(n => n.name.includes('2х3,175') || n.name.includes('2x3.175') || n.name.includes('2х3.175'));
  console.log('All matching 2х3,175 noms:', matching2.map(n => ({ id: n.id, name: n.name, type: n.type })));
}

findDuplicateNoms().catch(console.error);
