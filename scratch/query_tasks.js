global.window = {
  myConfirmedWrites: new Set()
};

const { supabase } = await import('../src/supabase.js');

async function run() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, plan_snapshot')
    .order('created_at', { ascending: false })
    .limit(10);
  
  if (error) {
    console.error(error);
    return;
  }
  
  for (const t of tasks) {
    if (!t.plan_snapshot) continue;
    console.log(`Task ID: ${t.id}`);
    console.log(JSON.stringify(t.plan_snapshot, null, 2));
    console.log('====================================');
  }
}

run();
