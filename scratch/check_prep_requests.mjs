import { createClient } from '@supabase/supabase-js';

const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmihncnkiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc3NDAyNzg3OSwiZXhwIjoyMDg5NjAzODc5fQ.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';
const baseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';

const supabase = createClient(baseUrl, key);

async function check() {
  console.log('--- Checking active preparation tasks ---');
  const { data: prepTasks, error: tErr } = await supabase
    .from('tasks')
    .select('id, step, status, machine_name, planned_sets, plan_snapshot, created_at')
    .eq('step', 'Підготовка')
    .neq('status', 'completed')
    .order('created_at', { ascending: false });

  if (tErr) {
    console.error('Error fetching prep tasks:', tErr);
    return;
  }

  console.log(`Found ${prepTasks.length} active preparation tasks.`);

  for (const task of prepTasks) {
    console.log(`\nPrep Task ID: ${task.id} (${task.status}) created_at: ${task.created_at}`);
    console.log('plan_snapshot:', JSON.stringify(task.plan_snapshot));

    const { data: reqs, error: rErr } = await supabase
      .from('material_requests')
      .select('*')
      .eq('task_id', task.id);

    if (rErr) console.error('Error fetching reqs:', rErr);
    console.log(`Matching material_requests count: ${reqs ? reqs.length : 0}`);
    if (reqs && reqs.length > 0) {
      reqs.forEach(r => console.log('  Req:', r.id, r.details, r.status, r.quantity));
    }
  }

  console.log('\n--- Checking active cutting tasks for sheet requests without prep requests ---');
  const { data: cutTasks } = await supabase
    .from('tasks')
    .select('id, step, status, plan_snapshot, order_id, created_at')
    .eq('step', 'Розкрій')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(10);

  if (cutTasks) {
    for (const task of cutTasks) {
      const { data: reqs } = await supabase
        .from('material_requests')
        .select('*')
        .eq('task_id', task.id);
      console.log(`Cutting Task ID ${task.id} (Order ${task.order_id}): ${reqs?.length || 0} requests.`);
      (reqs || []).forEach(r => console.log('  ->', r.id, r.details, r.category, r.status));
    }
  }
}

check();
