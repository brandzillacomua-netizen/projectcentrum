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
  
  const { data: tasks, error } = await supabase.from('tasks').select('*').eq('order_id', orderId);
  if (error) {
    console.error(error);
    return;
  }
  
  console.log(`Tasks for order 30062026-01 (${orderId}):`);
  tasks.forEach(t => {
    console.log(`- Task ID: ${t.id}, Step: ${t.step}, Status: ${t.status}, batch_index: ${t.batch_index}`);
  });
}

run();
