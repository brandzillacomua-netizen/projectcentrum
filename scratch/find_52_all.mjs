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

async function findTaskWith52() {
  await prodClient.auth.signInWithPassword({
    email: 'alexinj@centrum.local',
    password: '9eFAZQ6yaDjA-kwRp7dKkg!A9z'
  });

  const { data: tasks } = await prodClient
    .from('tasks')
    .select('*')
    .order('created_at', { ascending: false });

  console.log(`Checking ${tasks.length} tasks in prod...`);
  for (const t of tasks) {
    const snap = t.plan_snapshot || {};
    for (const [k, v] of Object.entries(snap)) {
      if (v?.name?.includes('3-39')) {
        console.log(`Task ${t.id} - ${v.name}: sheets=${v.sheets}, planSheets=${v.planned_sheets}, need=${v.need}, plan=${v.plan}, material=${v.material}, t300=${v.sheets_t300}, t700=${v.sheets_t700}`);
      }
    }
  }
}

findTaskWith52().catch(console.error);
