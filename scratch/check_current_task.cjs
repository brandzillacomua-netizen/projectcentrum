const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function run() {
  // Fetch tasks
  const { data: tasks, error: tErr } = await supabase.from('tasks').select('*, orders(*)').order('created_at', { ascending: false });
  if (tErr) {
    console.error("Error tasks:", tErr);
    return;
  }
  
  const targetTask = tasks.find(t => JSON.stringify(t.plan_snapshot || {}).includes("Київ"));
  if (!targetTask) {
    console.log("No task with 'Київ' found.");
    return;
  }
  console.log(`Found Task: ${targetTask.id}, Order: ${targetTask.orders?.order_num}, Status: ${targetTask.status}`);
  console.log("Plan snapshot:", JSON.stringify(targetTask.plan_snapshot, null, 2));

  const { data: cards, error: cErr } = await supabase.from('work_cards').select('*').eq('task_id', targetTask.id);
  if (cErr) {
    console.error("Error fetching cards:", cErr);
    return;
  }
  console.log(`Found ${cards.length} cards:`);
  cards.forEach(c => {
    console.log(`  Card ID: ${c.id}, Nom ID: ${c.nomenclature_id}, Machine: "${c.machine}", Operation: "${c.operation}", Info: "${c.card_info}"`);
  });
  return;
  for (const t of targetTasks) {
    console.log(`\n--- Task ID: ${t.id}, Status: ${t.status}, Snapshot keys: ${Object.keys(t.plan_snapshot || {})}`);
    console.log("Snapshot entries:", JSON.stringify(t.plan_snapshot, null, 2));

    const { data: cards, error: cErr } = await supabase.from('work_cards').select('*').eq('task_id', t.id);
    if (cErr) {
      console.error("Error cards:", cErr);
      continue;
    }
    console.log(`Cards found: ${cards.length}`);
    cards.forEach(c => {
      console.log(`  Card ID: ${c.id}, Nom ID: ${c.nomenclature_id}, Machine: "${c.machine}", Info: "${c.card_info}"`);
    });
  }
}

run();
