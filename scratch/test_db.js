const { createClient } = require('@supabase/supabase-client');

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
  console.log('Fetching total row count from work_card_history...');
  const { data: allRows, error: allErr } = await supabase
    .from('work_card_history')
    .select('id, completed_at, created_at, scrap_qty, stage_name, operator_name')
    .order('created_at', { ascending: false });

  if (allErr) {
    console.error('Error fetching all rows:', allErr);
    return;
  }

  console.log(`Total rows in work_card_history: ${allRows.length}`);
  
  const scrapRows = allRows.filter(r => Number(r.scrap_qty) > 0);
  console.log(`Total scrap rows: ${scrapRows.length}`);

  console.log('\nLast 15 scrap rows:');
  scrapRows.slice(0, 15).forEach(r => {
    console.log(`ID: ${r.id} | completed_at: ${r.completed_at} | created_at: ${r.created_at} | scrap_qty: ${r.scrap_qty} | stage: ${r.stage_name} | operator: ${r.operator_name}`);
  });

  // Let's also check date range filtering
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const startIso = oneYearAgo.toISOString();
  const endIso = new Date().toISOString();

  console.log(`\nSimulating filter: completed_at >= ${startIso} AND completed_at <= ${endIso}`);
  const filteredCompleted = scrapRows.filter(r => r.completed_at >= startIso && r.completed_at <= endIso);
  console.log(`Scrap rows filtered by completed_at: ${filteredCompleted.length}`);

  console.log(`\nSimulating filter: created_at >= ${startIso} AND created_at <= ${endIso}`);
  const filteredCreated = scrapRows.filter(r => r.created_at >= startIso && r.created_at <= endIso);
  console.log(`Scrap rows filtered by created_at: ${filteredCreated.length}`);
}

run();
