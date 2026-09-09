import { createClient } from '@supabase/supabase-js';

const prodClient = createClient(
  'https://hurzutjytlcvtbvihnry.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI',
  {
    global: {
      headers: {
        'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
      }
    }
  }
);

async function checkTask() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: t } = await prodClient
    .from('tasks')
    .select('*')
    .eq('id', '3f02455f-e512-44de-b2bb-4251b05d6556')
    .single();

  const snap = t.plan_snapshot || {};
  for (const [k, v] of Object.entries(snap)) {
    if (v?.name?.includes('3-39')) {
      console.log('Part 3-39:', v);
    }
  }
}

checkTask().catch(console.error);
