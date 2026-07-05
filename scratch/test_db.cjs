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
  console.log('Fetching rows with scrap_qty > 0...');
  const { data: scrapRows, error } = await supabase
    .from('work_card_history')
    .select('*')
    .gt('scrap_qty', 0)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching scrap:', error);
    return;
  }

  console.log(`Total scrap rows found in DB: ${scrapRows.length}`);
  
  if (scrapRows.length > 0) {
    console.log('\nFirst 10 scrap rows:');
    scrapRows.slice(0, 10).forEach(r => {
      console.log(`ID: ${r.id} | completed_at: ${r.completed_at} | scrap_qty: ${r.scrap_qty} | stage: ${r.stage_name} | operator: ${r.operator_name}`);
    });
  }
}

run();
