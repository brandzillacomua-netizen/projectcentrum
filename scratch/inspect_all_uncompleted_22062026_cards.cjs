const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const { data: cards } = await supabase.from('work_cards')
    .select('*')
    .neq('status', 'completed');
  
  const matched = (cards || []).filter(c => String(c.card_info).includes('22062026'));
  console.log(`Found ${matched.length} uncompleted cards containing '22062026':`);
  matched.forEach(c => {
    console.log(`Card ID: ${c.id} | Info: "${c.card_info}" | Status: ${c.status} | Op: ${c.operation} | TaskId: ${c.task_id}`);
  });
}

run().catch(console.error);
