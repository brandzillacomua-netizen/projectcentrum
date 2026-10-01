const { createClient } = require('@supabase/supabase-js');

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(url, key);

async function findHistory() {
  await supabase.auth.signInWithPassword({
    email: 'vvv@centrum.local',
    password: 'vvv'
  });

  console.log('=== SEARCHING FOR 261001-1, 261001-2, 261001-3, 261001-4 IN VARIOUS TABLES ===');

  // Search work_card_history
  const { data: hist } = await supabase
    .from('work_card_history')
    .select('*')
    .or('card_info.ilike.%261001%,stage_name.ilike.%261001%')
    .limit(20);
  console.log('work_card_history matches:', hist);

  // Search material_requests
  const { data: reqs } = await supabase
    .from('material_requests')
    .select('id, order_id, details, created_at')
    .ilike('details', '%261001%');
  console.log('material_requests matches for 261001:', reqs);

  // Search tasks
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, order_id, created_at, plan_snapshot')
    .gte('created_at', '2026-10-01T00:00:00');
  console.log('tasks today:', tasks);

  // Search bz_inventory_reservations
  const { data: bzRes } = await supabase
    .from('bz_inventory_reservations')
    .select('id, order_id, task_id, release_reason, created_at')
    .gte('created_at', '2026-10-01T00:00:00');
  console.log('bz_inventory_reservations today:', bzRes);
}

findHistory();
