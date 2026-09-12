import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  { global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } } }
);

async function verifyDeletion() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data } = await prodClient
    .from('work_cards')
    .select('*')
    .eq('id', '0a1f2133-9390-4710-82b5-08aa58f300d0');

  console.log('Work card 0a1f2133-9390-4710-82b5-08aa58f300d0 query result:', data);
}

verifyDeletion().catch(console.error);
