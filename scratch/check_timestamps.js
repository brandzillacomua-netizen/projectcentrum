import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      'x-mes-secret': 'CentrumMES2026SecretKey_a9f8'
    }
  }
});

async function main() {
  const { data: orderData } = await supabase
    .from('orders')
    .select('*')
    .eq('order_num', '27062026-01')
    .single();

  const { data: tasksData } = await supabase
    .from('tasks')
    .select('id, step, status, created_at, completed_at')
    .eq('order_id', orderData.id);

  console.log('TASKS CREATION TIMESTAMPS:');
  tasksData.forEach(t => {
    console.log(`Task: ${t.step}`);
    console.log(`  ID: ${t.id}`);
    console.log(`  Created: ${t.created_at}`);
    console.log(`  Completed: ${t.completed_at}`);
    console.log(`  Status: ${t.status}`);
  });
}

main();
