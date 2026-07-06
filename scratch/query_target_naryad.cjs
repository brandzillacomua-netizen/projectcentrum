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
  const orderId = 'e037c400-9797-421d-9c79-3e3651f30ac7';
  const targetId = 'c869a1af-9388-44c7-8d3e-5babf375a68b';

  console.log(`Searching and deleting key ${targetId} from tasks for order ${orderId}...`);

  const { data: tasks, error: fetchErr } = await supabase
    .from('tasks')
    .select('*')
    .eq('order_id', orderId);

  if (fetchErr) {
    console.error('Error fetching tasks:', fetchErr);
    return;
  }

  for (const task of tasks) {
    if (task.plan_snapshot && task.plan_snapshot[targetId]) {
      const snap = { ...task.plan_snapshot };
      delete snap[targetId];
      
      const { error: updErr } = await supabase
        .from('tasks')
        .update({ plan_snapshot: snap })
        .eq('id', task.id);

      if (updErr) {
        console.error(`Error updating task ${task.id}:`, updErr);
      } else {
        console.log(`Successfully removed key from task ${task.id}`);
      }
    }
  }
  console.log('Done!');
}

run();
