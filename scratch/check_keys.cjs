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
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', '53741df6-bd90-476b-9000-2c4bec9e9080');
  
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  tasks.forEach(t => {
    console.log(`Task ID: ${t.id}, Step: ${t.step}`);
    if (t.plan_snapshot) {
      const keys = Object.keys(t.plan_snapshot);
      console.log("Keys:", keys.slice(0, 5));
      const hasUuidKeys = keys.some(k => uuidRegex.test(k));
      console.log("hasUuidKeys:", hasUuidKeys);
    } else {
      console.log("No plan_snapshot");
    }
  });
}

run();
