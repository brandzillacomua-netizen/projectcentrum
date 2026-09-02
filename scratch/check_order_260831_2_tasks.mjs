import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI'
const supabase = createClient(supabaseUrl, supabaseKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
})

async function main() {
  const { data: tasks } = await supabase.from('tasks').select('*').eq('order_id', '962aae12-7faf-4688-81a3-999bd315cca6');
  console.log('=== TASKS FOR ORDER 260831-2 ===');
  tasks.forEach(t => {
    console.log(`ID: ${t.id} | Step: "${t.step}" | Status: "${t.status}" | WhConf: ${t.warehouse_conf} | EngConf: ${t.engineer_conf} | DirConf: ${t.director_conf} | Batch: ${t.batch_index} | CreatedAt: ${t.created_at}`);
  });
}

main().catch(console.error);
