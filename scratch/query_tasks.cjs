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
  const taskId = '4cf750d0-8c07-4885-88ce-33066569e426';
  const { data: task } = await supabase.from('tasks').select('*').eq('id', taskId).single();
  console.log('Task plan_snapshot:');
  console.log(JSON.stringify(task?.plan_snapshot, null, 2));

  // Let's fetch nomenclatures for the keys in plan_snapshot
  if (task?.plan_snapshot) {
    const ids = Object.keys(task.plan_snapshot);
    const { data: noms } = await supabase.from('nomenclatures').select('*').in('id', ids);
    console.log('\nNomenclatures in plan_snapshot:');
    noms.forEach(n => {
      console.log(`- ID: ${n.id}, Name: ${n.name}, Units per sheet: ${n.units_per_sheet}`);
    });
  }
}

run();
