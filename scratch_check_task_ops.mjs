import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  const taskId = '9c7c012e-7bde-40bd-b649-3d97f5c787d0';

  const { data: cards } = await supabase
    .from('work_cards')
    .select('id, operation, status, card_info, created_at, started_at, completed_at, updated_at')
    .eq('task_id', taskId);

  console.log(`Cards in task:`);
  for (const c of (cards || [])) {
    const num = (c.card_info || '').match(/№\d+\/\d+/)?.[0] || 'no-num';
    console.log(`${num} | id=${c.id.slice(0, 8)} | op="${c.operation}" | status="${c.status}" | started=${c.started_at?.slice(0, 16)} | comp=${c.completed_at?.slice(0, 16)} | up=${c.updated_at?.slice(0, 16)}`);
  }
}

main().catch(console.error);
