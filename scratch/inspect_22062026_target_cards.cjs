const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://hurzutjytlcvtbvihnry.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1cnp1dGp5dGxjdnRidmlobnJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwMjc4NzksImV4cCI6MjA4OTYwMzg3OX0.0GETYIfUpEDVcpcMoZcAe3dLXtiafNNE1eegbbK1XUI';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { headers: { 'x-mes-secret': 'CentrumMES2026SecretKey_a9f8' } }
});

async function run() {
  const { data: cards } = await supabase.from('work_cards')
    .select('*')
    .in('task_id', ['c7055204-cbad-4f74-bae6-4a8a79c14b7e', 'f3b9403d-3be6-47c5-b793-f0f7187e2d34']);
  
  console.log(`Found ${cards?.length} cards for those tasks:`);
  cards.forEach(c => {
    if (c.status !== 'completed' || (c.card_info || '').includes('[REDO]')) {
      console.log(`Card ID: ${c.id} | Info: ${c.card_info} | Status: ${c.status} | Op: ${c.operation}`);
    }
  });
}

run().catch(console.error);
