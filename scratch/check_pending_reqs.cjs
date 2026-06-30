const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const { data: reqs } = await supabase.from('material_requests')
    .select('*')
    .eq('task_id', 'c7055204-cbad-4f74-bae6-4a8a79c14b7e');
    
  const pending = (reqs || []).filter(r => r.status === 'pending');
  console.log(`Total requests for task: ${reqs?.length || 0}`);
  console.log(`Pending requests for task: ${pending.length}`);
  pending.forEach(r => {
    console.log(`Pending Request ID: ${r.id} | Details: "${r.details}" | Qty: ${r.quantity}`);
  });
}

run().catch(console.error);
