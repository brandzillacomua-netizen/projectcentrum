const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
})

async function checkTasks() {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('id, batch_index, status, warehouse_conf, engineer_conf, director_conf, plan_snapshot')
    .in('status', ['issued', 'in-progress'])
    .eq('warehouse_conf', 'false')

  if (error) {
    console.error(error)
    return
  }
  console.log('Tasks with warehouse_conf = false:');
  tasks.forEach(t => {
    console.log(`Task ${t.id} - status: ${t.status}, prep: ${t.plan_snapshot?._prep_num}, batch: ${t.batch_index}`);
  })

  // We should fix them
  const toUpdate = tasks.filter(t => t.engineer_conf && t.director_conf);
  console.log('Updating to true for', toUpdate.map(t => t.id));

  for (let t of toUpdate) {
    await supabase.from('tasks').update({ warehouse_conf: 'true' }).eq('id', t.id);
    console.log(`Updated ${t.id} to true`);
  }
}
checkTasks();
