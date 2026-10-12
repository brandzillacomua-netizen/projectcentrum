import { createClient } from '@supabase/supabase-js';

const url = 'https://hurzutjytlcvtbvihnry.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const supabase = createClient(url, key);

async function run() {
  await supabase.auth.signInWithPassword({ email: 'vvv@centrum.local', password: 'vvv' });

  const taskIds = [
    'aeee6441-e6e4-4112-b570-5bb173107910',
    'dd8f6032-bc26-4eda-ad99-413e26515978',
    '7c9f0d04-12c9-4273-b4f8-d2430593b3f8',
    '6076b2e8-99b7-409d-8a51-b9c333ab63d7'
  ];

  // 1. Fetch task details
  const { data: tasks, error: tErr } = await supabase
    .from('tasks')
    .select('*')
    .in('id', taskIds);

  console.log('=== TASKS DETAILS ===');
  for (const t of tasks || []) {
    console.log(`\nTASK #${t.naryad_number} (id: ${t.id})`);
    console.log(`  Step: ${t.step}, Status: ${t.status}, Title: ${t.title || t.name}`);
    console.log(`  Warehouse Conf: ${t.warehouse_conf}, Engineer Conf: ${t.engineer_conf}`);
  }

  // 2. Fetch all cards for each of these tasks
  for (const tid of taskIds) {
    const t = tasks?.find(x => x.id === tid);
    const { data: cards, error: cErr } = await supabase
      .from('work_cards')
      .select('id, task_id, operation, status, quantity, card_info, created_at, updated_at, completed_at, nomenclature_id')
      .eq('task_id', tid);

    console.log(`\n======================================================`);
    console.log(`TASK #${t?.naryad_number} (id: ${tid}) - CARDS COUNT: ${cards?.length}`);
    
    // Status breakdown
    const stCount = {};
    cards?.forEach(c => stCount[c.status] = (stCount[c.status] || 0) + 1);
    console.log('Cards by status:', stCount);

    // Cutting cards
    const cutCards = cards?.filter(c => (c.operation || '').toLowerCase().includes('розкрій')) || [];
    console.log(`Cutting cards (Розкрій) count: ${cutCards.length}`);
    for (const c of cutCards) {
      console.log(`  Card ${c.id}: status=${c.status}, qty=${c.quantity}, completed_at=${c.completed_at}, info=${c.card_info}`);
    }
  }
}

run().catch(console.error);
