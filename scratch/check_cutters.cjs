const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' }
  }
});

async function main() {
  const { data: tasks } = await supabase.from('tasks').select('id, plan_snapshot').order('id', { ascending: false }).limit(20);
  console.log('--- TASKS PLAN SNAPSHOTS ---');
  tasks?.forEach(t => {
    if (t.plan_snapshot) {
      if (t.plan_snapshot.selectedCutters) {
        console.log(`Task #${t.id} selectedCutters:`, t.plan_snapshot.selectedCutters);
      }
      Object.entries(t.plan_snapshot || {}).forEach(([k, v]) => {
        if (v?.selected_cutters) {
          console.log(`Task #${t.id} part ${k} selected_cutters:`, v.selected_cutters);
        }
      });
    }
  });

  const { data: noms } = await supabase.from('nomenclatures').select('id, name, type, characteristic').ilike('name', '%фреза%').limit(50);
  console.log('--- CUTTER NOMENCLATURES ---');
  console.log(noms);
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
