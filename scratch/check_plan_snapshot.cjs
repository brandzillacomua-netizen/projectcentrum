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
  const { data: tasks } = await supabase.from('tasks').select('*').in('order_id', [
    '53741df6-bd90-476b-9000-2c4bec9e9080', // 10000pcs
    '227e62dc-8c6e-42a0-bee8-9ad8743169c7'  // 2000pcs
  ]);
  
  for (const t of tasks || []) {
    console.log(`\nTask ID: ${t.id}, Order ID: ${t.order_id}, Planned Sets: ${t.planned_sets}, Status: ${t.status}, Step: ${t.step}`);
    if (t.plan_snapshot) {
      console.log('Snapshot Keys:', Object.keys(t.plan_snapshot));
      console.log('Snapshot metadata:', t.plan_snapshot._metadata || t.plan_snapshot.materialSummary);
      // Let's print one child part snapshot
      const firstKey = Object.keys(t.plan_snapshot).find(k => k !== '_metadata' && k !== 'materialSummary');
      if (firstKey) {
        console.log(`Snapshot for child ${firstKey}:`, t.plan_snapshot[firstKey]);
      }
    }
  }
}

run();
