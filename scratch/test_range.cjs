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
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  oneYearAgo.setHours(0,0,0,0);
  const startIso = oneYearAgo.toISOString();
  
  const end = new Date();
  end.setHours(23,59,59,999);
  const endIso = end.toISOString();

  console.log(`Querying completed_at between ${startIso} and ${endIso}...`);

  const { data, error } = await supabase
    .from('work_card_history')
    .select('id, completed_at, scrap_qty')
    .gte('completed_at', startIso)
    .lte('completed_at', endIso)
    .order('created_at', { ascending: false })
    .limit(2000);

  if (error) {
    console.error('Query error:', error);
    return;
  }

  console.log(`Total history rows returned: ${data.length}`);
  const scrapInResults = data.filter(r => Number(r.scrap_qty) > 0);
  console.log(`Scrap rows inside these 2000 results: ${scrapInResults.length}`);
}

run();
