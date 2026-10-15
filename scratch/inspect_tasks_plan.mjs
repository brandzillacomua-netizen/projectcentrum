import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const targetOrderId = '62330578-eb54-401c-8258-c2efd660780e';

  // Find tasks for order 261001-5
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, step, status, plan_snapshot')
    .eq('order_id', targetOrderId);

  console.log('--- TASKS ---');
  for (const t of (tasks || [])) {
    console.log(`Task: ${t.id} | Step: ${t.step} | Status: ${t.status}`);
    const snap = t.plan_snapshot;
    if (snap) {
      for (const [k, v] of Object.entries(snap)) {
        if (v && typeof v === 'object' && v.name && (v.stock > 0 || v.need > 0)) {
          console.log(`   ${v.name}: need=${v.need}, stock=${v.stock}, plan=${v.plan}`);
        }
      }
    }
  }
}

main();
